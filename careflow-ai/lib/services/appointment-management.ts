/**
 * Server-side appointment management service.
 *
 * Provides:
 *   1. Cancellation — patient-authorized, preserves history
 *   2. Rescheduling — cancel-after-confirm pattern using existing booking engine
 *
 * Uses PostgreSQL RPC functions from migrations 004, 005, 006.
 * Returns explicit domain error codes that map 1:1 to UI messages.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requestSlotHold } from '@/lib/services/slot-holds';
import { confirmBooking } from '@/lib/services/booking-confirmation';

// ============================================================
// Domain error types — Cancellation
// ============================================================

export type CancelErrorCode =
  | 'APPOINTMENT_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CANNOT_CANCEL'
  | 'CANCEL_FAILED'
  | 'DATABASE_ERROR';

export interface CancelSuccess {
  ok: true;
  appointmentId: string;
  message: string;
}

export interface CancelError {
  ok: false;
  error: CancelErrorCode;
  message: string;
}

export type CancelResult = CancelSuccess | CancelError;

// ============================================================
// Domain error types — Rescheduling
// ============================================================

export type RescheduleErrorCode =
  | 'APPOINTMENT_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CANNOT_RESCHEDULE'
  | 'SLOT_NOT_AVAILABLE'
  | 'HOLD_FAILED'
  | 'CONFIRM_FAILED'
  | 'RESCHEDULE_FAILED'
  | 'DATABASE_ERROR';

export interface RescheduleSuccess {
  ok: true;
  oldAppointmentId: string;
  newAppointmentId: string;
  message: string;
}

export interface RescheduleError {
  ok: false;
  error: RescheduleErrorCode;
  message: string;
  /** If the new booking failed, the old appointment may still be active */
  oldAppointmentStillActive?: boolean;
}

export type RescheduleResult = RescheduleSuccess | RescheduleError;

// ============================================================
// RPC result types
// ============================================================

interface PGRpcResult {
  success: boolean;
  appointment_id?: string;
  error?: string;
  message?: string;
  current_status?: string;
}

// ============================================================
// Cancellation service
// ============================================================

/**
 * Cancel an appointment.
 *
 * Verifies patient ownership before cancelling.
 * The slot is automatically freed (overlap checks only consider
 * PENDING/CONFIRMED appointments). The appointment row is preserved
 * with status=CANCELLED for history.
 */
export async function cancelAppointment(
  appointmentId: string,
  patientId: string
): Promise<CancelResult> {
  if (!appointmentId) {
    return { ok: false, error: 'APPOINTMENT_NOT_FOUND', message: 'Appointment ID is required.' };
  }
  if (!patientId) {
    return { ok: false, error: 'UNAUTHORIZED', message: 'Patient identity is required.' };
  }

  const supabase = createSupabaseServerClient();
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'cancel_appointment_with_auth',
    {
      p_appointment_id: appointmentId,
      p_patient_id: patientId,
    }
  );

  if (rpcError) {
    console.error('[AppointmentManagement] cancel RPC error:', rpcError.message);
    return { ok: false, error: 'DATABASE_ERROR', message: `Database error: ${rpcError.message}` };
  }

  const result = rpcResult as PGRpcResult;

  if (result.success) {
    return {
      ok: true,
      appointmentId: result.appointment_id!,
      message: result.message || 'Appointment cancelled successfully.',
    };
  }

  const pgError = result.error || 'unknown';
  const knownErrors: CancelErrorCode[] = [
    'APPOINTMENT_NOT_FOUND',
    'UNAUTHORIZED',
    'CANNOT_CANCEL',
    'CANCEL_FAILED',
  ];

  if (knownErrors.includes(pgError as CancelErrorCode)) {
    return {
      ok: false,
      error: pgError as CancelErrorCode,
      message: result.message || 'Cancellation failed.',
    };
  }

  return {
    ok: false,
    error: 'CANCEL_FAILED',
    message: result.message || 'An unexpected error occurred during cancellation.',
  };
}

// ============================================================
// Rescheduling service
// ============================================================

/**
 * Reschedule an appointment to a new time slot.
 *
 * Flow (cancel-after-confirm pattern):
 *   1. Verify old appointment exists, belongs to patient, is cancellable
 *   2. Acquire a hold on the new slot (using existing booking engine)
 *   3. Confirm the new booking (atomic hold→appointment conversion)
 *   4. Cancel the old appointment
 *
 * If step 3 fails, the old appointment is NOT cancelled.
 * If step 4 fails after step 3 succeeds, the new appointment exists
 * and the old one is also still active (edge case — both slots are
 * occupied until the old one expires or is manually cleaned up).
 *
 * @param appointmentId - The existing appointment to reschedule
 * @param patientId     - The authenticated patient's ID
 * @param newDate       - New appointment date (YYYY-MM-DD)
 * @param newStartTime  - New start time (HH:MM:SS)
 * @param newEndTime    - New end time (HH:MM:SS)
 * @param chiefComplaint - Reason for visit (preserved from old appt)
 * @param urgency       - Urgency level
 */
export async function rescheduleAppointment(
  appointmentId: string,
  patientId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  chiefComplaint?: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<RescheduleResult> {
  // --- Input validation ---
  if (!appointmentId) {
    return { ok: false, error: 'APPOINTMENT_NOT_FOUND', message: 'Appointment ID is required.' };
  }
  if (!patientId) {
    return { ok: false, error: 'UNAUTHORIZED', message: 'Patient identity is required.' };
  }
  if (!newDate || !newStartTime || !newEndTime) {
    return { ok: false, error: 'RESCHEDULE_FAILED', message: 'New date and time are required.' };
  }

  const supabase = createSupabaseServerClient();

  // --- Step 1: Verify old appointment exists and belongs to patient ---
  const { data: oldApt, error: fetchError } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, status, start_time, end_time')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !oldApt) {
    return {
      ok: false,
      error: 'APPOINTMENT_NOT_FOUND',
      message: 'Appointment not found.',
    };
  }

  if (oldApt.patient_id !== patientId) {
    return {
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'You do not own this appointment.',
    };
  }

  if (oldApt.status !== 'PENDING' && oldApt.status !== 'CONFIRMED') {
    return {
      ok: false,
      error: 'CANNOT_RESCHEDULE',
      message: `Cannot reschedule an appointment with status: ${oldApt.status}.`,
      oldAppointmentStillActive: true,
    };
  }

  // --- Step 2: Acquire hold on the new slot ---
  // The old appointment still occupies its original slot, but the new slot
  // must be a different time (or the same slot on a different date).
  const holdResult = await requestSlotHold(
    oldApt.doctor_id,
    patientId,
    newDate,
    newStartTime,
    newEndTime
  );

  if (!holdResult.ok) {
    return {
      ok: false,
      error: 'HOLD_FAILED',
      message: `Could not reserve the new slot: ${holdResult.message}`,
      oldAppointmentStillActive: true,
    };
  }

  // --- Step 3: Confirm the new booking ---
  const confirmResult = await confirmBooking(
    holdResult.holdId,
    patientId,
    chiefComplaint || undefined,
    undefined,
    urgency
  );

  if (!confirmResult.ok) {
    return {
      ok: false,
      error: 'CONFIRM_FAILED',
      message: `New booking could not be confirmed: ${confirmResult.message}`,
      oldAppointmentStillActive: true,
    };
  }

  // --- Step 4: Cancel the old appointment ---
  // The new appointment is confirmed. Now safely cancel the old one.
  const cancelResult = await cancelAppointment(appointmentId, patientId);

  if (!cancelResult.ok) {
    // Edge case: new appointment exists but old couldn't be cancelled.
    // Both slots are occupied. Log for manual intervention.
    console.error(
      '[AppointmentManagement] CRITICAL: New appointment created but old could not be cancelled.',
      'New:', confirmResult.appointmentId,
      'Old:', appointmentId,
      'Cancel error:', cancelResult.error
    );
    return {
      ok: true, // The reschedule "succeeded" — new appointment exists
      oldAppointmentId: appointmentId,
      newAppointmentId: confirmResult.appointmentId,
      message: 'New appointment confirmed, but the old one could not be automatically cancelled. Please contact support.',
    };
  }

  // --- Full success ---
  return {
    ok: true,
    oldAppointmentId: appointmentId,
    newAppointmentId: confirmResult.appointmentId,
    message: 'Appointment rescheduled successfully.',
  };
}
