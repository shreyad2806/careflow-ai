/**
 * Server actions for the booking flow.
 *
 * These run server-side and call the services directly.
 * The client never computes slots or accesses the database.
 */

'use server';

import { generateAvailableSlots, type SlotGenerationResult } from '@/lib/services/availability';
import {
  requestSlotHold,
  releaseSlotHold,
  validateHold,
  type HoldResult,
} from '@/lib/services/slot-holds';

/**
 * Fetch available slots for a doctor on a given date.
 * Called by the booking client component when the user selects a date.
 */
export async function fetchAvailableSlots(
  doctorId: string,
  date: string,
  slotDurationMinutes?: number
): Promise<SlotGenerationResult> {
  return generateAvailableSlots(doctorId, date, slotDurationMinutes);
}

/**
 * Request a 5-minute temporary hold on a time slot.
 *
 * Called when the patient clicks on an available slot.
 * Returns the hold ID and expiration timestamp.
 */
export async function requestHold(
  doctorId: string,
  patientId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<HoldResult> {
  return requestSlotHold(doctorId, patientId, date, startTime, endTime);
}

/**
 * Release an active hold.
 *
 * Called when:
 *   - The hold expires (client-side timer fires)
 *   - The patient selects a different slot
 *   - The patient navigates away
 */
export async function releaseHold(
  holdId: string,
  patientId?: string
): Promise<{ ok: boolean; message: string }> {
  return releaseSlotHold(holdId, patientId);
}

/**
 * Validate that a hold is still active.
 *
 * Called by the client to check hold status before confirming booking.
 */
export async function checkHoldValidity(
  holdId: string
): Promise<{ valid: boolean; reason?: string }> {
  return validateHold(holdId);
}
