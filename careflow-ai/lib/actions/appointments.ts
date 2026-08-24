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
import { notifyBookingCancelled } from '@/lib/services/notification-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Cancel an appointment.
 *
 * Verifies patient ownership before cancelling.
 * The slot is automatically freed for other bookings.
 * Notification is dispatched fire-and-forget after successful cancellation.
 */
export async function cancelAppointment(
  appointmentId: string,
  patientId: string
): Promise<CancelResult> {
  const result = await cancelAppointmentService(appointmentId, patientId);

  // --- Fire-and-forget: dispatch notification after successful cancellation ---
  if (result.ok) {
    dispatchCancellationNotification(result.appointmentId, patientId).catch((err) => {
      console.error('[Appointment] Cancellation notification failed (non-blocking):', err);
    });
  }

  return result;
}

/**
 * Dispatch a booking cancelled notification.
 * Fire-and-forget: errors are caught and logged, never thrown.
 */
async function dispatchCancellationNotification(
  appointmentId: string,
  patientId: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();

    // Fetch appointment details
    const { data: apt } = await supabase
      .from('appointments')
      .select('doctor_id, appointment_date, start_time')
      .eq('id', appointmentId)
      .single();

    if (!apt) return;

    // Fetch doctor name
    let doctorName = 'Your doctor';
    const { data: doctor } = await supabase
      .from('doctors')
      .select('profile_id')
      .eq('id', apt.doctor_id)
      .single();

    if (doctor) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', doctor.profile_id)
        .single();
      if (profile) doctorName = profile.full_name;
    }

    // Fetch patient profile ID
    const { data: patient } = await supabase
      .from('patients')
      .select('profile_id')
      .eq('id', patientId)
      .single();

    if (!patient) return;

    // Format time
    const [h, m] = apt.start_time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const timeStr = `${displayH}:${m.toString().padStart(2, '0')} ${period}`;

    await notifyBookingCancelled({
      patientProfileId: patient.profile_id,
      appointmentId,
      doctorName,
      date: apt.appointment_date,
      time: timeStr,
    });
  } catch (err) {
    console.error('[Appointment] dispatchCancellationNotification error:', err);
  }
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
