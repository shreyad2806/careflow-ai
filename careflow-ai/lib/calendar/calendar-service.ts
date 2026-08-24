/**
 * Calendar Service Orchestrator
 *
 * Manages the lifecycle of calendar sync for appointments:
 *   - Appointment confirmed → create events (patient + doctor)
 *   - Appointment rescheduled → update events
 *   - Appointment cancelled → delete events
 *
 * Design principles:
 *   - Calendar sync is ALWAYS fire-and-forget
 *   - Appointment booking/cancel/reschedule succeeds FIRST
 *   - Calendar sync happens AFTER, in the background
 *   - Calendar failure never blocks or rolls back the appointment
 *   - All errors are caught and logged, never thrown
 *
 * The orchestrator coordinates:
 *   1. CalendarProvider (Mock or Google) for API calls
 *   2. Supabase calendar_sync table for metadata
 *   3. Supabase oauth_tokens table for token management
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CalendarProvider, CalendarEventInput, CalendarSyncResult, CalendarSyncRole } from './types';

// ============================================================
// Logger
// ============================================================

function logCalendar(level: 'info' | 'warn' | 'error', msg: string): void {
  const prefix = '[CalendarService]';
  if (process.env.NODE_ENV === 'production' && level === 'info') return;
  if (level === 'error') console.error(`${prefix} ❌ ${msg}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️  ${msg}`);
  else console.log(`${prefix} ✅ ${msg}`);
}

// ============================================================
// Provider singleton
// ============================================================

let _provider: CalendarProvider | null = null;

/**
 * Get or initialize the calendar provider.
 * Uses MockCalendarProvider unless GOOGLE_CLIENT_ID is configured.
 */
export async function getCalendarProvider(): Promise<CalendarProvider> {
  if (_provider) return _provider;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (clientId && clientSecret && redirectUri) {
    // Real Google Calendar provider
    const { GoogleCalendarProvider, SupabaseTokenStore } = await import('./google-calendar-provider');
    _provider = new GoogleCalendarProvider({
      clientId,
      clientSecret,
      redirectUri,
      tokenStore: new SupabaseTokenStore(),
    });
    logCalendar('info', `Provider initialized: google (OAuth configured)`);
  } else {
    // Mock provider for development
    const { MockCalendarProvider } = await import('./mock-calendar-provider');
    _provider = new MockCalendarProvider();
    logCalendar('info', `Provider initialized: mock (Google OAuth not configured)`);
  }

  return _provider;
}

/**
 * Reset the provider singleton (for testing).
 */
export function resetCalendarProvider(): void {
  _provider = null;
}

// ============================================================
// Sync record management (Supabase)
// ============================================================

async function upsertSyncRecord(
  appointmentId: string,
  profileId: string,
  provider: string,
  role: CalendarSyncRole,
  externalEventId: string | null,
  syncStatus: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.rpc('upsert_calendar_sync', {
      p_appointment_id: appointmentId,
      p_profile_id: profileId,
      p_provider: provider,
      p_role: role,
      p_external_event_id: externalEventId,
      p_sync_status: syncStatus,
    });
  } catch (err) {
    logCalendar('error', `Failed to upsert sync record: ${err}`);
  }
}

async function markSyncFailed(
  appointmentId: string,
  profileId: string,
  provider: string,
  role: CalendarSyncRole,
  errorMessage: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.rpc('mark_calendar_sync_failed', {
      p_appointment_id: appointmentId,
      p_profile_id: profileId,
      p_provider: provider,
      p_role: role,
      p_error_message: errorMessage,
    });
  } catch (err) {
    logCalendar('error', `Failed to mark sync failed: ${err}`);
  }
}

async function markSyncDeleted(
  appointmentId: string,
  profileId: string,
  provider: string,
  role: CalendarSyncRole
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.rpc('mark_calendar_sync_deleted', {
      p_appointment_id: appointmentId,
      p_profile_id: profileId,
      p_provider: provider,
      p_role: role,
    });
  } catch (err) {
    logCalendar('error', `Failed to mark sync deleted: ${err}`);
  }
}

// ============================================================
// Resolve appointment context
// ============================================================

interface AppointmentContext {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  doctorProfileId: string;
  patientProfileId: string;
  doctorName: string;
  patientName: string;
  date: string;
  startTime: string;
  endTime: string;
  chiefComplaint: string;
}

async function resolveAppointmentContext(appointmentId: string): Promise<AppointmentContext | null> {
  try {
    const supabase = createSupabaseServerClient();

    // Fetch appointment
    const { data: apt } = await supabase
      .from('appointments')
      .select('doctor_id, patient_id, appointment_date, start_time, end_time, chief_complaint')
      .eq('id', appointmentId)
      .single();

    if (!apt) return null;

    // Fetch doctor profile
    const { data: doctor } = await supabase
      .from('doctors')
      .select('profile_id')
      .eq('id', apt.doctor_id)
      .single();

    // Fetch patient profile
    const { data: patient } = await supabase
      .from('patients')
      .select('profile_id')
      .eq('id', apt.patient_id)
      .single();

    if (!doctor || !patient) return null;

    // Fetch names
    const [{ data: doctorProfile }, { data: patientProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', doctor.profile_id).single(),
      supabase.from('profiles').select('full_name').eq('id', patient.profile_id).single(),
    ]);

    // Format time for display
    const formatTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
    };

    return {
      appointmentId,
      doctorId: apt.doctor_id,
      patientId: apt.patient_id,
      doctorProfileId: doctor.profile_id,
      patientProfileId: patient.profile_id,
      doctorName: doctorProfile?.full_name || 'Doctor',
      patientName: patientProfile?.full_name || 'Patient',
      date: apt.appointment_date,
      startTime: apt.start_time,
      endTime: apt.end_time,
      chiefComplaint: apt.chief_complaint || '',
    };
  } catch (err) {
    logCalendar('error', `Failed to resolve appointment context: ${err}`);
    return null;
  }
}

// ============================================================
// Public API: Lifecycle hooks
// ============================================================

/**
 * Sync calendar events for a newly confirmed appointment.
 * Creates events for both the patient and the doctor.
 *
 * Called fire-and-forget AFTER appointment confirmation succeeds.
 */
export async function syncOnAppointmentConfirmed(appointmentId: string): Promise<void> {
  const op = 'CONFIRMED';
  logCalendar('info', `${op} appointment=${appointmentId}`);

  const ctx = await resolveAppointmentContext(appointmentId);
  if (!ctx) {
    logCalendar('warn', `${op} Could not resolve appointment context — skipping sync`);
    return;
  }

  const provider = await getCalendarProvider();

  // --- Create event for patient ---
  const patientEventInput: CalendarEventInput & { _profileId?: string } = {
    appointmentId,
    date: ctx.date,
    startTime: ctx.startTime,
    endTime: ctx.endTime,
    summary: `Appointment with Dr. ${ctx.doctorName}`,
    description: ctx.chiefComplaint
      ? `Reason: ${ctx.chiefComplaint}\nCareFlow AI Appointment`
      : 'CareFlow AI Appointment',
    timezone: 'Asia/Kolkata',
    _profileId: ctx.patientProfileId,
  };

  const patientResult = await provider.createEvent(patientEventInput);
  await handleSyncResult(appointmentId, ctx.patientProfileId, provider.provider, 'patient', patientResult);

  // --- Create event for doctor ---
  const doctorEventInput: CalendarEventInput & { _profileId?: string } = {
    appointmentId,
    date: ctx.date,
    startTime: ctx.startTime,
    endTime: ctx.endTime,
    summary: `Patient: ${ctx.patientName}`,
    description: ctx.chiefComplaint
      ? `Reason: ${ctx.chiefComplaint}\nCareFlow AI Appointment`
      : 'CareFlow AI Appointment',
    timezone: 'Asia/Kolkata',
    _profileId: ctx.doctorProfileId,
  };

  const doctorResult = await provider.createEvent(doctorEventInput);
  await handleSyncResult(appointmentId, ctx.doctorProfileId, provider.provider, 'doctor', doctorResult);
}

/**
 * Sync calendar events for a rescheduled appointment.
 * Updates existing events if synced, or creates new ones.
 *
 * Called fire-and-forget AFTER reschedule succeeds.
 * @param oldAppointmentId - The old (cancelled) appointment ID
 * @param newAppointmentId - The new (confirmed) appointment ID
 */
export async function syncOnAppointmentRescheduled(
  oldAppointmentId: string,
  newAppointmentId: string
): Promise<void> {
  const op = 'RESCHEDULED';
  logCalendar('info', `${op} old=${oldAppointmentId} new=${newAppointmentId}`);

  // Delete events for the old appointment
  await syncOnAppointmentCancelled(oldAppointmentId);

  // Create events for the new appointment
  await syncOnAppointmentConfirmed(newAppointmentId);
}

/**
 * Sync calendar events for a cancelled appointment.
 * Deletes events from the calendar for both patient and doctor.
 *
 * Called fire-and-forget AFTER cancellation succeeds.
 */
export async function syncOnAppointmentCancelled(appointmentId: string): Promise<void> {
  const op = 'CANCELLED';
  logCalendar('info', `${op} appointment=${appointmentId}`);

  const provider = await getCalendarProvider();

  try {
    const supabase = createSupabaseServerClient();

    // Fetch sync records for this appointment
    const { data: syncs } = await supabase
      .rpc('get_calendar_syncs', { p_appointment_id: appointmentId });

    if (!syncs || syncs.length === 0) {
      logCalendar('info', `${op} No sync records found — nothing to delete`);
      return;
    }

    for (const sync of syncs) {
      if (!sync.external_event_id || sync.sync_status === 'deleted') {
        continue;
      }

      let result: CalendarSyncResult;

      // Google provider needs profileId for auth
      if (provider.provider === 'google') {
        const { GoogleCalendarProvider } = await import('./google-calendar-provider');
        if (provider instanceof GoogleCalendarProvider) {
          result = await provider.deleteEventForProfile(sync.external_event_id, sync.profile_id);
        } else {
          result = await provider.deleteEvent(sync.external_event_id);
        }
      } else {
        result = await provider.deleteEvent(sync.external_event_id);
      }

      if (result.ok) {
        await markSyncDeleted(appointmentId, sync.profile_id, sync.provider, sync.role);
        logCalendar('info', `${op} Deleted ${sync.role} event: ${sync.external_event_id}`);
      } else {
        logCalendar('error', `${op} Failed to delete ${sync.role} event: ${result.message}`);
      }
    }
  } catch (err) {
    logCalendar('error', `${op} Unexpected error: ${err}`);
  }
}

// ============================================================
// Internal: Handle sync result and persist metadata
// ============================================================

async function handleSyncResult(
  appointmentId: string,
  profileId: string,
  providerName: string,
  role: CalendarSyncRole,
  result: CalendarSyncResult
): Promise<void> {
  if (result.ok) {
    await upsertSyncRecord(
      appointmentId,
      profileId,
      providerName,
      role,
      result.externalEventId,
      'synced'
    );
  } else {
    await markSyncFailed(
      appointmentId,
      profileId,
      providerName,
      role,
      result.message
    );
    logCalendar('error', `Sync failed for ${role}: ${result.message}`);
  }
}
