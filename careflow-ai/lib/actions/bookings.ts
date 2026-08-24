/**
 * Server actions for the booking confirmation flow.
 *
 * These run server-side and call the services directly.
 * The client never computes slots or accesses the database.
 */

'use server';

import { confirmBooking, type BookingResult } from '@/lib/services/booking-confirmation';

/**
 * Confirm a booking by consuming a slot hold.
 *
 * Called when the patient clicks "Confirm Appointment" after selecting
 * a time slot and providing a reason. The hold must be active and
 * belong to this patient.
 *
 * @param holdId       - The slot hold ID to consume
 * @param patientId    - The authenticated patient's ID
 * @param reason       - Reason for visit (chief complaint)
 * @param urgency      - Urgency level
 */
export async function confirmAppointment(
  holdId: string,
  patientId: string,
  reason: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<BookingResult> {
  return confirmBooking(holdId, patientId, reason, undefined, urgency);
}
