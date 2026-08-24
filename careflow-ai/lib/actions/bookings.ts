/**
 * Server actions for the booking confirmation flow.
 *
 * These run server-side and call the services directly.
 * The client never computes slots or accesses the database.
 */

'use server';

import { confirmBooking, type BookingResult } from '@/lib/services/booking-confirmation';
import { notifyBookingConfirmed } from '@/lib/services/notification-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Confirm a booking by consuming a slot hold.
 *
 * Called when the patient clicks "Confirm Appointment" after selecting
 * a time slot and providing a reason. The hold must be active and
 * belong to this patient.
 *
 * Notification is dispatched fire-and-forget after successful booking.
 * Booking success is never coupled to notification success.
 */
export async function confirmAppointment(
  holdId: string,
  patientId: string,
  reason: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<BookingResult> {
  const result = await confirmBooking(holdId, patientId, reason, undefined, urgency);

  // --- Fire-and-forget: dispatch notification AND calendar sync after successful booking ---
  if (result.ok) {
    dispatchBookingNotification(result.appointmentId, patientId).catch((err) => {
      // Notification failure must never affect booking success
      console.error('[Booking] Notification dispatch failed (non-blocking):', err);
    });
    syncCalendarOnConfirm(result.appointmentId).catch((err) => {
      // Calendar sync failure must never affect booking success
      console.error('[Booking] Calendar sync failed (non-blocking):', err);
    });
  }

  return result;
}

/**
 * Sync calendar events for a confirmed appointment.
 * Fire-and-forget: errors are caught and logged, never thrown.
 */
async function syncCalendarOnConfirm(appointmentId: string): Promise<void> {
  try {
    const { syncOnAppointmentConfirmed } = await import('@/lib/calendar/calendar-service');
    await syncOnAppointmentConfirmed(appointmentId);
  } catch (err) {
    console.error('[Booking] syncCalendarOnConfirm error:', err);
  }
}

/**
 * Dispatch a booking confirmed notification.
 * Fire-and-forget: errors are caught and logged, never thrown.
 */
async function dispatchBookingNotification(
  appointmentId: string,
  patientId: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();

    // Fetch appointment + doctor details for the notification message
    const { data: apt } = await supabase
      .from('appointments')
      .select('doctor_id, appointment_date, start_time')
      .eq('id', appointmentId)
      .single();

    if (!apt) return;

    // Fetch doctor profile name
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

    // Fetch patient profile ID for the notification recipient
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

    await notifyBookingConfirmed({
      patientProfileId: patient.profile_id,
      appointmentId,
      doctorName,
      date: apt.appointment_date,
      time: timeStr,
    });
  } catch (err) {
    // Non-blocking: log and continue
    console.error('[Booking] dispatchBookingNotification error:', err);
  }
}
