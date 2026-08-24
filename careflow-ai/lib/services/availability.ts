/**
 * Server-side doctor availability and slot generation service.
 *
 * All business logic lives here — the frontend never computes slots.
 * Uses the Supabase server client exclusively.
 *
 * Timezone: All dates and times are treated as server-local (the database
 * stores DATE and TIME without timezone). The client sends a date string
 * (YYYY-MM-DD) in the user's local timezone; the server generates slots
 * against that date. In production this should be replaced with explicit
 * timezone handling per-doctor.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DoctorAvailability, AppointmentRow, SlotHold, DoctorLeave } from '@/lib/supabase/types';

// ============================================================
// Domain result types
// ============================================================

export type SlotGenerationErrorCode =
  | 'doctor_not_found'
  | 'no_availability'
  | 'invalid_date'
  | 'past_date'
  | 'no_slots_available'
  | 'doctor_on_leave'
  | 'database_error';

export interface SlotGenerationSuccess {
  ok: true;
  doctorId: string;
  date: string;
  dayOfWeek: number;
  slots: AvailableSlot[];
  /** The availability windows that were used to generate slots */
  windows: AvailabilityWindow[];
  /** Intervals that were excluded (booked + held) */
  excludedIntervals: TimeInterval[];
}

export interface SlotGenerationError {
  ok: false;
  error: SlotGenerationErrorCode;
  message: string;
}

export type SlotGenerationResult = SlotGenerationSuccess | SlotGenerationError;

export interface AvailableSlot {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  /** Is this slot in the past (for today)? */
  isPast: boolean;
}

export interface AvailabilityWindow {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  slotDurationMinutes: number;
}

export interface TimeInterval {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  source: 'appointment' | 'hold' | 'leave';
}

// ============================================================
// Internal helpers
// ============================================================

/** Parse "HH:MM" to minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Check if two time intervals overlap (exclusive end) */
function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
         timeToMinutes(a.endTime) > timeToMinutes(b.startTime);
}

/** Check if a slot overlaps any interval in a list */
function slotOverlapsIntervals(
  slotStart: number,
  slotEnd: number,
  intervals: TimeInterval[]
): boolean {
  for (const interval of intervals) {
    const intStart = timeToMinutes(interval.startTime);
    const intEnd = timeToMinutes(interval.endTime);
    if (slotStart < intEnd && slotEnd > intStart) {
      return true;
    }
  }
  return false;
}

/** Merge overlapping availability windows into non-overlapping ranges */
function mergeWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  if (windows.length === 0) return [];

  // Sort by start time
  const sorted = [...windows].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const merged: AvailabilityWindow[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (timeToMinutes(next.startTime) <= timeToMinutes(current.endTime)) {
      // Overlapping or adjacent — merge by extending end time
      current.endTime = timeToMinutes(next.endTime) > timeToMinutes(current.endTime)
        ? next.endTime
        : current.endTime;
      // Use the shorter slot duration of the two
      current.slotDurationMinutes = Math.min(
        current.slotDurationMinutes,
        next.slotDurationMinutes
      );
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

// ============================================================
// Core exported functions
// ============================================================

/**
 * Get all active availability windows for a doctor on a specific date.
 * Returns merged windows if multiple overlap.
 */
export async function getDoctorAvailabilityForDate(
  doctorId: string,
  date: string
): Promise<{ windows: AvailabilityWindow[]; doctorExists: boolean }> {
  const supabase = createSupabaseServerClient();

  // Validate date format
  const dateObj = new Date(date + 'T00:00:00');
  if (isNaN(dateObj.getTime())) {
    return { windows: [], doctorExists: false };
  }

  const dayOfWeek = dateObj.getDay();

  // Verify doctor exists
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('is_active', true)
    .single();

  if (!doctor) {
    return { windows: [], doctorExists: false };
  }

  // Fetch availability for this day of week
  const { data: availability, error } = await supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .order('start_time', { ascending: true });

  if (error || !availability || availability.length === 0) {
    return { windows: [], doctorExists: true };
  }

  const typedAvail = availability as unknown as DoctorAvailability[];
  const rawWindows: AvailabilityWindow[] = typedAvail.map(a => ({
    startTime: a.start_time.substring(0, 5),
    endTime: a.end_time.substring(0, 5),
    slotDurationMinutes: a.slot_duration_minutes,
  }));

  // Merge overlapping windows
  const windows = mergeWindows(rawWindows);
  return { windows, doctorExists: true };
}

/**
 * Get all booked appointment intervals for a doctor on a specific date.
 * Includes PENDING and CONFIRMED appointments only.
 */
export async function getBookedIntervals(
  doctorId: string,
  date: string
): Promise<TimeInterval[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .in('status', ['PENDING', 'CONFIRMED']);

  if (error || !data) return [];

  return (data as unknown as Array<{ start_time: string; end_time: string }>).map(a => ({
    startTime: a.start_time.substring(0, 5),
    endTime: a.end_time.substring(0, 5),
    source: 'appointment' as const,
  }));
}

/**
 * Get all active (non-expired) slot hold intervals for a doctor on a specific date.
 */
export async function getActiveHoldIntervals(
  doctorId: string,
  date: string
): Promise<TimeInterval[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('slot_holds')
    .select('start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .gt('expires_at', new Date().toISOString());

  if (error || !data) return [];

  return (data as unknown as Array<{ start_time: string; end_time: string }>).map(h => ({
    startTime: h.start_time.substring(0, 5),
    endTime: h.end_time.substring(0, 5),
    source: 'hold' as const,
  }));
}

/**
 * Check if a doctor has an approved leave covering the given date.
 * Returns the leave interval if found, otherwise null.
 */
export async function getLeaveIntervals(
  doctorId: string,
  date: string
): Promise<TimeInterval[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('doctor_leaves')
    .select('start_date, end_date')
    .eq('doctor_id', doctorId)
    .eq('status', 'approved')
    .lte('start_date', date)
    .gte('end_date', date);

  if (error || !data || data.length === 0) return [];

  // A full-day leave blocks the entire day — represent as 00:00–23:59
  return (data as unknown as Array<{ start_date: string; end_date: string }>).map(() => ({
    startTime: '00:00',
    endTime: '23:59',
    source: 'leave' as const,
  }));
}

/**
 * Generate all available (free) slots for a doctor on a given date.
 *
 * Algorithm:
 *   1. Fetch availability windows → merge overlaps
 *   2. Fetch booked intervals + active hold intervals + leave intervals
 *   3. For each window, iterate by slot_duration_minutes
 *   4. Skip slots that overlap any excluded interval
 *   5. Skip slots that are in the past (for today)
 *   6. Return available slots with metadata
 */
export async function generateAvailableSlots(
  doctorId: string,
  date: string,
  slotDurationMinutes?: number
): Promise<SlotGenerationResult> {
  // --- Validate date ---
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      ok: false,
      error: 'invalid_date',
      message: `Invalid date format: "${date}". Expected YYYY-MM-DD.`,
    };
  }

  const dateObj = new Date(date + 'T00:00:00');
  if (isNaN(dateObj.getTime())) {
    return {
      ok: false,
      error: 'invalid_date',
      message: `Could not parse date: "${date}".`,
    };
  }

  const dayOfWeek = dateObj.getDay();

  // Check for past date (only today or future allowed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestedDate = new Date(dateObj);
  requestedDate.setHours(0, 0, 0, 0);

  if (requestedDate < today) {
    return {
      ok: false,
      error: 'past_date',
      message: `Cannot book slots for past date: ${date}.`,
    };
  }

  // --- Fetch doctor availability ---
  const { windows, doctorExists } = await getDoctorAvailabilityForDate(doctorId, date);

  if (!doctorExists) {
    return {
      ok: false,
      error: 'doctor_not_found',
      message: `Doctor not found or inactive: ${doctorId}.`,
    };
  }

  if (windows.length === 0) {
    return {
      ok: false,
      error: 'no_availability',
      message: `Doctor has no availability on ${date} (day ${dayOfWeek}).`,
    };
  }

  // --- Check doctor leave ---
  const leaveIntervals = await getLeaveIntervals(doctorId, date);
  if (leaveIntervals.length > 0) {
    return {
      ok: false,
      error: 'doctor_on_leave',
      message: `Doctor is on approved leave for ${date}.`,
    };
  }

  // --- Fetch exclusion intervals (booked + held) ---
  const [bookedIntervals, holdIntervals] = await Promise.all([
    getBookedIntervals(doctorId, date),
    getActiveHoldIntervals(doctorId, date),
  ]);

  const excludedIntervals: TimeInterval[] = [...bookedIntervals, ...holdIntervals];

  // --- Determine "now" for past-slot filtering (only matters for today) ---
  const isToday = requestedDate.getTime() === today.getTime();
  const nowMinutes = isToday
    ? today.getHours() * 60 + today.getMinutes()
    : -1; // -1 means no filtering needed

  // --- Generate slots ---
  const slots: AvailableSlot[] = [];

  for (const window of windows) {
    const duration = slotDurationMinutes ?? window.slotDurationMinutes;
    let current = timeToMinutes(window.startTime);
    const windowEnd = timeToMinutes(window.endTime);

    while (current + duration <= windowEnd) {
      const slotStart = current;
      const slotEnd = current + duration;

      const isPast = isToday && slotEnd <= nowMinutes;

      if (!isPast && !slotOverlapsIntervals(slotStart, slotEnd, excludedIntervals)) {
        slots.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          isPast: false,
        });
      }

      current += duration;
    }
  }

  if (slots.length === 0) {
    return {
      ok: false,
      error: 'no_slots_available',
      message: `No available slots on ${date}. All slots are booked, held, or in the past.`,
    };
  }

  return {
    ok: true,
    doctorId,
    date,
    dayOfWeek,
    slots,
    windows,
    excludedIntervals,
  };
}

/**
 * Check if a specific slot is still available.
 * Useful before confirming a booking.
 */
export async function isSlotAvailable(
  doctorId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string }> {
  // Check leave
  const leaves = await getLeaveIntervals(doctorId, date);
  if (leaves.length > 0) {
    return { available: false, reason: 'doctor_on_leave' };
  }

  // Check booked
  const booked = await getBookedIntervals(doctorId, date);
  const slotInterval: TimeInterval = { startTime, endTime, source: 'appointment' };
  for (const b of booked) {
    if (intervalsOverlap(slotInterval, b)) {
      return { available: false, reason: 'already_booked' };
    }
  }

  // Check holds
  const holds = await getActiveHoldIntervals(doctorId, date);
  for (const h of holds) {
    if (intervalsOverlap(slotInterval, h)) {
      return { available: false, reason: 'slot_held' };
    }
  }

  return { available: true };
}
