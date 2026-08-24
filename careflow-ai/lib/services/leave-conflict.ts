/**
 * Leave Conflict Handling Service
 *
 * Handles the full lifecycle of creating a doctor leave:
 *   1. Validate inputs
 *   2. Check for overlapping approved leaves
 *   3. Insert the leave record
 *   4. If approved: find affected appointments, create notifications, release holds
 *
 * Design decisions:
 *   - Uses PostgreSQL RPC functions for atomic operations where possible
 *   - Notifications are created server-side, not sent via email yet
 *   - Overlapping leaves are prevented at both application and database level
 *   - Slot hold release is best-effort (holds may have already expired)
 *   - The function is safe to call multiple times (idempotent for notifications)
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// Domain types
// ============================================================

export interface CreateLeaveInput {
  doctorId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  reason?: string;
  status?: 'pending' | 'approved';
}

export interface CreateLeaveSuccess {
  ok: true;
  leaveId: string;
  affectedAppointments: number;
  notificationsCreated: number;
  holdsReleased: number;
}

export interface CreateLeaveError {
  ok: false;
  error: string;
  message: string;
}

export type CreateLeaveResult = CreateLeaveSuccess | CreateLeaveError;

export interface AffectedAppointment {
  appointmentId: string;
  patientId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

// ============================================================
// Logger
// ============================================================

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const prefix = '[LeaveConflict]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// Core: Create a doctor leave with conflict handling
// ============================================================

/**
 * Create a doctor leave record with full conflict handling.
 *
 * When status is 'approved':
 *   1. Finds all PENDING/CONFIRMED appointments in the leave range
 *   2. Creates notification records for affected patients
 *   3. Releases any overlapping slot holds
 *
 * The leave record itself is protected by:
 *   - Application-level overlap check (hasOverlappingLeave RPC)
 *   - Database-level trigger (check_leave_overlap)
 *   - Unique partial index on (doctor_id, start_date, end_date) WHERE status = 'approved'
 */
export async function createDoctorLeave(
  input: CreateLeaveInput
): Promise<CreateLeaveResult> {
  const startTime = Date.now();
  const { doctorId, startDate, endDate, reason, status = 'approved' } = input;

  // --- Step 1: Validate inputs ---
  if (!doctorId) {
    return { ok: false, error: 'INVALID_DOCTOR', message: 'Doctor ID is required.' };
  }
  if (!startDate || !endDate) {
    return { ok: false, error: 'INVALID_DATES', message: 'Start and end dates are required.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: 'INVALID_DATES', message: 'Dates must be in YYYY-MM-DD format.' };
  }
  if (startDate > endDate) {
    return { ok: false, error: 'INVALID_DATES', message: 'Start date must be before or equal to end date.' };
  }

  const supabase = createSupabaseServerClient();

  // --- Step 2: Verify doctor exists ---
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('is_active', true)
    .single();

  if (doctorError || !doctor) {
    log('warn', `Doctor not found or inactive: ${doctorId}`);
    return { ok: false, error: 'DOCTOR_NOT_FOUND', message: `Doctor not found: ${doctorId}` };
  }

  log('info', `Creating leave: doctorId=${doctorId} range=${startDate} to ${endDate} status=${status}`);

  // --- Step 3: Check for overlapping approved leaves (application level) ---
  const { data: hasOverlap } = await supabase
    .rpc('has_overlapping_leave', {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

  if (hasOverlap) {
    log('warn', `Overlapping approved leave exists for doctor ${doctorId} during ${startDate}–${endDate}`);
    return {
      ok: false,
      error: 'OVERLAPPING_LEAVE',
      message: 'This doctor already has an approved leave that overlaps this period.',
    };
  }

  // --- Step 4: Insert the leave record ---
  const { data: leave, error: insertError } = await supabase
    .from('doctor_leaves')
    .insert({
      doctor_id: doctorId,
      start_date: startDate,
      end_date: endDate,
      reason: reason || null,
      status,
    })
    .select('id')
    .single();

  if (insertError) {
    // Handle unique constraint violation (duplicate leave)
    if (insertError.code === '23505') {
      log('warn', `Duplicate leave detected for doctor ${doctorId} during ${startDate}–${endDate}`);
      return {
        ok: false,
        error: 'DUPLICATE_LEAVE',
        message: 'A leave for this doctor during this period already exists.',
      };
    }
    log('error', `Failed to insert leave: ${insertError.message}`);
    return {
      ok: false,
      error: 'DATABASE_ERROR',
      message: `Failed to create leave: ${insertError.message}`,
    };
  }

  const leaveId = leave.id;
  log('info', `Leave created: id=${leaveId}`);

  // --- Step 5: If approved, handle conflicts ---
  let affectedAppointments: AffectedAppointment[] = [];
  let notificationsCreated = 0;
  let holdsReleased = 0;

  if (status === 'approved') {
    // 5a: Find affected appointments
    const { data: affectedData, error: affectedError } = await supabase
      .rpc('find_affected_appointments', {
        p_doctor_id: doctorId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

    if (!affectedError && affectedData && affectedData.length > 0) {
      affectedAppointments = affectedData.map((row: Record<string, unknown>) => ({
        appointmentId: row.appointment_id as string,
        patientId: row.patient_id as string,
        appointmentDate: row.appointment_date as string,
        startTime: row.start_time as string,
        endTime: row.end_time as string,
        status: row.status as string,
      }));

      log('info', `Found ${affectedAppointments.length} affected appointments`);

      // 5b: Create notifications for affected patients
      notificationsCreated = await createLeaveNotifications(
        supabase,
        affectedAppointments,
        doctorId,
        startDate,
        endDate,
        reason
      );

      // 5c: Release overlapping slot holds (best-effort)
      const { data: holdsCount } = await supabase
        .rpc('release_holds_for_leave', {
          p_doctor_id: doctorId,
          p_start_date: startDate,
          p_end_date: endDate,
        });

      holdsReleased = Number(holdsCount) || 0;
      if (holdsReleased > 0) {
        log('info', `Released ${holdsReleased} overlapping slot holds`);
      }
    }
  }

  const elapsed = Date.now() - startTime;
  log(
    'info',
    `Leave creation complete in ${elapsed}ms: ` +
      `leaveId=${leaveId} affected=${affectedAppointments.length} ` +
      `notifications=${notificationsCreated} holdsReleased=${holdsReleased}`
  );

  return {
    ok: true,
    leaveId,
    affectedAppointments: affectedAppointments.length,
    notificationsCreated,
    holdsReleased,
  };
}

// ============================================================
// Notification creation
// ============================================================

/**
 * Create notification records for patients affected by a doctor leave.
 *
 * Deduplication: checks if a notification already exists for the same
 * patient + doctor + date range before creating.
 */
async function createLeaveNotifications(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  affectedAppointments: AffectedAppointment[],
  doctorId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<number> {
  // Fetch doctor profile name for the notification
  let doctorName = 'Your doctor';
  try {
    const { data: doctorRow } = await supabase
      .from('doctors')
      .select('profile_id')
      .eq('id', doctorId)
      .single();

    if (doctorRow) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', doctorRow.profile_id)
        .single();

      if (profile) doctorName = profile.full_name;
    }
  } catch {
    // Use fallback name
  }

  // Get patient profile IDs for notifications
  const patientIds = [...new Set(affectedAppointments.map(a => a.patientId))];
  const patientProfileMap = new Map<string, string>(); // patient_id → profile_id

  try {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, profile_id')
      .in('id', patientIds);

    if (patients) {
      for (const p of patients as Array<{ id: string; profile_id: string }>) {
        patientProfileMap.set(p.id, p.profile_id);
      }
    }
  } catch {
    // Use empty map — notifications will be skipped
  }

  // Create notifications for each affected patient
  let created = 0;
  const dateRangeText = startDate === endDate
    ? startDate
    : `${startDate} to ${endDate}`;

  for (const apt of affectedAppointments) {
    const profileId = patientProfileMap.get(apt.patientId);
    if (!profileId) continue;

    // Check for existing notification (deduplication)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('profile_id', profileId)
      .eq('type', 'urgent')
      .ilike('message', `%${dateRangeText}%`)
      .ilike('message', `%${doctorName}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Notification already exists — skip
      continue;
    }

    const reasonText = reason ? ` Reason: ${reason}.` : '';
    const dateText = apt.appointmentDate === startDate && apt.appointmentDate === endDate
      ? `on ${apt.appointmentDate}`
      : `on ${apt.appointmentDate}`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        profile_id: profileId,
        type: 'urgent',
        title: 'Doctor Leave — Appointment May Be Affected',
        message:
          `${doctorName} will be on leave ${dateRangeText}. ` +
          `Your appointment ${dateText} at ${apt.startTime} may be affected. ` +
          `Please contact the clinic to reschedule.${reasonText}`,
        is_read: false,
      });

    if (!error) {
      created++;
    }
  }

  log('info', `Created ${created} notifications for ${affectedAppointments.length} affected appointments`);
  return created;
}

// ============================================================
// Query helpers (exported for use in API routes and admin UI)
// ============================================================

/**
 * Get all affected appointments for a proposed leave period.
 * Useful for showing a preview before confirming the leave.
 */
export async function getAffectedAppointments(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<AffectedAppointment[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('find_affected_appointments', {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    appointmentId: row.appointment_id as string,
    patientId: row.patient_id as string,
    appointmentDate: row.appointment_date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    status: row.status as string,
  }));
}

/**
 * Check if a doctor has an overlapping approved leave.
 */
export async function hasOverlappingLeave(
  doctorId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .rpc('has_overlapping_leave', {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_exclude_id: excludeId || null,
    });

  return !!data;
}
