/**
 * Server-side booking confirmation service.
 *
 * Converts a slot hold into a confirmed appointment atomically.
 * Uses the PostgreSQL `confirm_booking_with_auth` function from
 * migration 005 which provides:
 *   - Patient ownership verification
 *   - Hold expiration check
 *   - Doctor availability re-check
 *   - Overlap detection
 *   - Atomic INSERT + DELETE in one transaction
 *   - FOR UPDATE lock to prevent concurrent confirmation of same hold
 *
 * Returns explicit domain error codes that map 1:1 to UI messages.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// Domain error types
// ============================================================

export type BookingErrorCode =
  | 'HOLD_NOT_FOUND'
  | 'HOLD_EXPIRED'
  | 'UNAUTHORIZED_HOLD'
  | 'SLOT_ALREADY_BOOKED'
  | 'DOCTOR_UNAVAILABLE'
  | 'BOOKING_CONFLICT'
  | 'BOOKING_FAILED'
  | 'DATABASE_ERROR';

export interface BookingSuccess {
  ok: true;
  appointmentId: string;
  message: string;
}

export interface BookingError {
  ok: false;
  error: BookingErrorCode;
  message: string;
}

export type BookingResult = BookingSuccess | BookingError;

// ============================================================
// Confirmation result from the PostgreSQL function
// ============================================================

interface PGConfirmResult {
  success: boolean;
  appointment_id?: string;
  error?: string;
  message?: string;
}

// ============================================================
// Core service function
// ============================================================

/**
 * Confirm a booking by consuming a slot hold.
 *
 * This is the ONLY way to create a confirmed appointment from a hold.
 * All validation happens server-side in the PostgreSQL function.
 *
 * @param holdId       - The slot hold ID to consume
 * @param patientId    - The authenticated patient's ID (from session/demo)
 * @param chiefComplaint - Optional reason for visit
 * @param aiAnalysisId - Optional AI analysis ID
 * @param urgency      - Urgency level (default: 'medium')
 */
export async function confirmBooking(
  holdId: string,
  patientId: string,
  chiefComplaint?: string,
  aiAnalysisId?: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<BookingResult> {
  // --- Input validation ---
  if (!holdId) {
    return {
      ok: false,
      error: 'HOLD_NOT_FOUND',
      message: 'Hold ID is required.',
    };
  }
  if (!patientId) {
    return {
      ok: false,
      error: 'BOOKING_FAILED',
      message: 'Patient identity is required.',
    };
  }

  // --- Call the PostgreSQL atomic confirmation function ---
  const supabase = createSupabaseServerClient();
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'confirm_booking_with_auth',
    {
      p_hold_id: holdId,
      p_patient_id: patientId,
      p_chief_complaint: chiefComplaint || null,
      p_ai_analysis_id: aiAnalysisId || null,
      p_urgency: urgency,
    }
  );

  if (rpcError) {
    console.error('[BookingConfirmation] RPC error:', rpcError.message);
    return {
      ok: false,
      error: 'DATABASE_ERROR',
      message: `Database error: ${rpcError.message}`,
    };
  }

  // --- Parse result ---
  const result = rpcResult as PGConfirmResult;

  if (result.success) {
    return {
      ok: true,
      appointmentId: result.appointment_id!,
      message: result.message || 'Appointment confirmed successfully.',
    };
  }

  // --- Map PostgreSQL error codes to domain errors ---
  const pgError = result.error || 'unknown';
  const pgMessage = result.message || 'Booking failed.';

  // Validate that pgError is a known BookingErrorCode
  const knownErrors: BookingErrorCode[] = [
    'HOLD_NOT_FOUND',
    'HOLD_EXPIRED',
    'UNAUTHORIZED_HOLD',
    'SLOT_ALREADY_BOOKED',
    'DOCTOR_UNAVAILABLE',
    'BOOKING_CONFLICT',
    'BOOKING_FAILED',
  ];

  if (knownErrors.includes(pgError as BookingErrorCode)) {
    return {
      ok: false,
      error: pgError as BookingErrorCode,
      message: pgMessage,
    };
  }

  // Fallback for unexpected errors from the DB function
  return {
    ok: false,
    error: 'BOOKING_FAILED',
    message: pgMessage,
  };
}
