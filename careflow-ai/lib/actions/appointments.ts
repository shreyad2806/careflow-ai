/**
 * Server actions for appointment cancellation and rescheduling.
 *
 * These run server-side and call the services directly.
 * The client never accesses the database.
 */

'use server';

import {
  cancelAppointment as cancelAppointmentService,
  rescheduleAppointment as rescheduleAppointmentService,
  type CancelResult,
  type RescheduleResult,
} from '@/lib/services/appointment-management';

/**
 * Cancel an appointment.
 *
 * Verifies patient ownership before cancelling.
 * The slot is automatically freed for other bookings.
 *
 * @param appointmentId - The appointment to cancel
 * @param patientId     - The authenticated patient's ID
 */
export async function cancelAppointment(
  appointmentId: string,
  patientId: string
): Promise<CancelResult> {
  return cancelAppointmentService(appointmentId, patientId);
}

/**
 * Reschedule an appointment to a new time slot.
 *
 * Acquires a hold on the new slot, confirms the new booking,
 * then cancels the old appointment. If the new booking fails,
 * the old appointment remains active.
 *
 * @param appointmentId - The existing appointment to reschedule
 * @param patientId     - The authenticated patient's ID
 * @param newDate       - New appointment date (YYYY-MM-DD)
 * @param newStartTime  - New start time (HH:MM:SS)
 * @param newEndTime    - New end time (HH:MM:SS)
 * @param reason        - Reason for visit
 * @param urgency       - Urgency level
 */
export async function rescheduleAppointment(
  appointmentId: string,
  patientId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  reason?: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<RescheduleResult> {
  return rescheduleAppointmentService(
    appointmentId,
    patientId,
    newDate,
    newStartTime,
    newEndTime,
    reason,
    urgency
  );
}
