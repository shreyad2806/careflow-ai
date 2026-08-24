/**
 * Server-side slot hold service.
 *
 * Provides atomic 5-minute temporary reservations on appointment slots.
 * Uses the PostgreSQL `acquire_slot_hold` function from migration 004
 * for database-level concurrency protection.
 *
 * Race conditions are prevented at the database level:
 *   - check_slot_available() ensures no overlapping appointment OR active hold
 *   - INSERT into slot_holds is the atomic commit point
 *   - Two concurrent requests: one INSERTs successfully, the other sees the
 *     first hold on the next check_slot_available() call
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SlotHold } from '@/lib/supabase/types';

// ============================================================
// Domain error types
// ============================================================

export type HoldErrorCode =
  | 'SLOT_NOT_AVAILABLE'
  | 'SLOT_ALREADY_HELD'
  | 'INVALID_DOCTOR'
  | 'INVALID_PATIENT'
  | 'INVALID_SLOT'
  | 'HOLD_ALREADY_EXISTS'
  | 'HOLD_NOT_FOUND'
  | 'HOLD_EXPIRED'
  | 'DOCTOR_ON_LEAVE'
  | 'DATABASE_ERROR';

export interface HoldSuccess {
  ok: true;
  holdId: string;
  expiresAt: string;     // ISO timestamp
  doctorId: string;
  patientId: string;
  date: string;
  startTime: string;     // "HH:MM:SS"
  endTime: string;       // "HH:MM:SS"
  holdDurationSeconds: number;
}

export interface HoldError {
  ok: false;
  error: HoldErrorCode;
  message: string;
}

export type HoldResult = HoldSuccess | HoldError;

export interface HoldValidationResult {
  valid: boolean;
  hold?: SlotHold;
  reason?: string;
}

// ============================================================
// Constants
// ============================================================

const HOLD_DURATION_SECONDS = 300; // 5 minutes

// ============================================================
// Core service functions
// ============================================================

/**
 * Request a temporary hold on a time slot.
 *
 * Calls the PostgreSQL `acquire_slot_hold` function which:
 *   1. Checks doctor is not on leave
 *   2. Checks slot has no overlapping appointment or active hold
 *   3. INSERTs the hold row (atomic commit point)
 *
 * Returns the hold ID and expiration timestamp on success.
 */
export async function requestSlotHold(
  doctorId: string,
  patientId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<HoldResult> {
  // --- Validate inputs ---
  if (!doctorId) {
    return { ok: false, error: 'INVALID_DOCTOR', message: 'Doctor ID is required.' };
  }
  if (!patientId) {
    return { ok: false, error: 'INVALID_PATIENT', message: 'Patient ID is required.' };
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'INVALID_SLOT', message: `Invalid date format: "${date}".` };
  }
  if (!startTime || !endTime) {
    return { ok: false, error: 'INVALID_SLOT', message: 'Start time and end time are required.' };
  }

  // --- Validate doctor exists ---
  const supabase = createSupabaseServerClient();
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('is_active', true)
    .single();

  if (doctorError || !doctor) {
    return {
      ok: false,
      error: 'INVALID_DOCTOR',
      message: `Doctor not found or inactive: ${doctorId}.`,
    };
  }

  // --- Validate patient exists ---
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .single();

  if (patientError || !patient) {
    return {
      ok: false,
      error: 'INVALID_PATIENT',
      message: `Patient not found: ${patientId}.`,
    };
  }

  // --- Check for existing active hold by this patient on this slot ---
  const { data: existingHold } = await supabase
    .from('slot_holds')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('patient_id', patientId)
    .eq('appointment_date', date)
    .eq('start_time', startTime)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingHold) {
    return {
      ok: false,
      error: 'HOLD_ALREADY_EXISTS',
      message: 'You already have an active hold on this slot.',
    };
  }

  // --- Call the PostgreSQL atomic hold function ---
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('acquire_slot_hold', {
      p_doctor_id: doctorId,
      p_patient_id: patientId,
      p_date: date,
      p_start_time: startTime,
      p_end_time: endTime,
      p_hold_seconds: HOLD_DURATION_SECONDS,
    });

  if (rpcError) {
    console.error('[SlotHold] acquire_slot_hold RPC error:', rpcError.message);
    return {
      ok: false,
      error: 'DATABASE_ERROR',
      message: `Database error: ${rpcError.message}`,
    };
  }

  // Parse the JSONB result
  const result = rpcResult as { success: boolean; hold_id?: string; error?: string };

  if (!result.success) {
    // Map PostgreSQL error codes to domain errors
    const pgError = result.error || 'unknown';
    if (pgError.includes('doctor_on_leave')) {
      return { ok: false, error: 'DOCTOR_ON_LEAVE', message: 'Doctor is on approved leave for this date.' };
    }
    if (pgError.includes('slot_unavailable') || pgError.includes('slot_taken')) {
      // Check if it's held by someone else or already booked
      const { data: conflictingHold } = await supabase
        .from('slot_holds')
        .select('patient_id')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', date)
        .eq('start_time', startTime)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (conflictingHold) {
        return {
          ok: false,
          error: 'SLOT_ALREADY_HELD',
          message: 'This slot is currently held by another patient.',
        };
      }
      return {
        ok: false,
        error: 'SLOT_NOT_AVAILABLE',
        message: 'This slot is no longer available (may be booked).',
      };
    }
    return {
      ok: false,
      error: 'SLOT_NOT_AVAILABLE',
      message: `Slot is not available: ${pgError}`,
    };
  }

  // --- Success — fetch the hold to get expires_at ---
  const holdId = result.hold_id!;
  const { data: hold, error: fetchError } = await supabase
    .from('slot_holds')
    .select('*')
    .eq('id', holdId)
    .single();

  if (fetchError || !hold) {
    // Hold was created but we can't read it back — return what we know
    const expiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString();
    return {
      ok: true,
      holdId,
      expiresAt,
      doctorId,
      patientId,
      date,
      startTime,
      endTime,
      holdDurationSeconds: HOLD_DURATION_SECONDS,
    };
  }

  const typedHold = hold as unknown as SlotHold;
  return {
    ok: true,
    holdId: typedHold.id,
    expiresAt: typedHold.expires_at,
    doctorId: typedHold.doctor_id,
    patientId: typedHold.patient_id,
    date: typedHold.appointment_date,
    startTime: typedHold.start_time,
    endTime: typedHold.end_time,
    holdDurationSeconds: HOLD_DURATION_SECONDS,
  };
}

/**
 * Release (explicitly cancel) an active hold.
 *
 * Deletes the hold row so the slot becomes immediately available.
 * Safe to call multiple times (idempotent).
 */
export async function releaseSlotHold(
  holdId: string,
  patientId?: string
): Promise<{ ok: boolean; message: string }> {
  if (!holdId) {
    return { ok: false, message: 'Hold ID is required.' };
  }

  const supabase = createSupabaseServerClient();

  // Build the query
  let query = supabase.from('slot_holds').delete().eq('id', holdId);

  // If patientId provided, only delete their own hold (safety check)
  if (patientId) {
    query = query.eq('patient_id', patientId);
  }

  const { error } = await query;

  if (error) {
    console.error('[SlotHold] release error:', error.message);
    return { ok: false, message: `Failed to release hold: ${error.message}` };
  }

  // Even if count is 0 (already deleted / expired), treat as success
  return { ok: true, message: 'Hold released successfully.' };
}

/**
 * Validate that a hold is still active and not expired.
 *
 * Returns the hold record if valid, or an error reason.
 */
export async function validateHold(
  holdId: string
): Promise<HoldValidationResult> {
  if (!holdId) {
    return { valid: false, reason: 'HOLD_NOT_FOUND' };
  }

  const supabase = createSupabaseServerClient();
  const { data: hold, error } = await supabase
    .from('slot_holds')
    .select('*')
    .eq('id', holdId)
    .maybeSingle();

  if (error || !hold) {
    return { valid: false, reason: 'HOLD_NOT_FOUND' };
  }

  const typedHold = hold as unknown as SlotHold;
  const expiresAt = new Date(typedHold.expires_at);
  if (expiresAt <= new Date()) {
    return { valid: false, reason: 'HOLD_EXPIRED' };
  }

  return { valid: true, hold: typedHold };
}

/**
 * Get an active hold by doctor + date + time (for UI state recovery).
 */
export async function getActiveHoldForSlot(
  doctorId: string,
  date: string,
  startTime: string
): Promise<SlotHold | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('slot_holds')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .eq('start_time', startTime)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return (data as unknown as SlotHold) ?? null;
}

/**
 * Clean up expired holds.
 *
 * Calls the PostgreSQL `cleanup_expired_holds()` function.
 * Safe to call from a scheduled job or on-demand.
 */
export async function cleanupExpiredHolds(): Promise<{ ok: boolean; cleanedCount: number }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('cleanup_expired_holds');

  if (error) {
    console.error('[SlotHold] cleanup error:', error.message);
    return { ok: false, cleanedCount: 0 };
  }

  return { ok: true, cleanedCount: Number(data) || 0 };
}

// ============================================================
// Concurrency verification (development/testing)
// ============================================================

/**
 * Simulate two concurrent hold attempts on the same slot.
 *
 * Fires two RPC calls in parallel and reports results.
 * Exactly one should succeed and one should fail.
 *
 * WARNING: This is a development/testing function.
 * Do NOT call in production.
 */
export async function simulateConcurrentHolds(
  doctorId: string,
  patientIdA: string,
  patientIdB: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{
  patientA: HoldResult;
  patientB: HoldResult;
  exactlyOneSucceeded: boolean;
  summary: string;
}> {
  // Fire both simultaneously
  const [resultA, resultB] = await Promise.all([
    requestSlotHold(doctorId, patientIdA, date, startTime, endTime),
    requestSlotHold(doctorId, patientIdB, date, startTime, endTime),
  ]);

  const aSucceeded = resultA.ok;
  const bSucceeded = resultB.ok;
  const exactlyOne = (aSucceeded && !bSucceeded) || (!aSucceeded && bSucceeded);

  let summary: string;
  if (exactlyOne) {
    const winner = aSucceeded ? 'A' : 'B';
    summary = `✓ Concurrency test PASSED: Patient ${winner} won the hold. The other was correctly rejected.`;
  } else if (aSucceeded && bSucceeded) {
    summary = '✗ Concurrency test FAILED: Both patients got holds — race condition not prevented!';
  } else {
    summary = `✗ Concurrency test FAILED: Both patients were rejected. A: ${resultA.ok ? 'ok' : resultA.error}, B: ${resultB.ok ? 'ok' : resultB.error}`;
  }

  return {
    patientA: resultA,
    patientB: resultB,
    exactlyOneSucceeded: exactlyOne,
    summary,
  };
}
