import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DoctorAvailability } from '@/lib/supabase/types';

export async function getDoctorAvailability(doctorId: string): Promise<DoctorAvailability[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true });

    if (error || !data) return [];
    return data as unknown as DoctorAvailability[];
  } catch (error) {
    console.error('Error fetching availability:', error);
    return [];
  }
}

export async function getAllDoctorAvailability(): Promise<DoctorAvailability[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('is_active', true)
      .order('doctor_id', { ascending: true });

    if (error || !data) return [];
    return data as unknown as DoctorAvailability[];
  } catch (error) {
    console.error('Unexpected error fetching all availability:', error);
    return [];
  }
}

export async function getAvailableSlots(
  doctorId: string,
  date: string
): Promise<string[]> {
  try {
    const supabase = createSupabaseServerClient();
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const { data: availability, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single();

    if (error || !availability) return [];

    const typed = availability as unknown as DoctorAvailability;
    const slots: string[] = [];
    const [startH, startM] = typed.start_time.split(':').map(Number);
    const [endH, endM] = typed.end_time.split(':').map(Number);
    const duration = typed.slot_duration_minutes;

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + duration <= endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      currentMinutes += duration;
    }

    const { data: booked } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['PENDING', 'CONFIRMED']);

    const bookedTimes = new Set((booked || []).map((a: any) => a.start_time));

    const { data: holds } = await supabase
      .from('slot_holds')
      .select('start_time')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .gt('expires_at', new Date().toISOString());

    const heldTimes = new Set((holds || []).map((h: any) => h.start_time));

    return slots.filter(slot => !bookedTimes.has(slot) && !heldTimes.has(slot));
  } catch (error) {
    console.error('Error generating available slots:', error);
    return [];
  }
}
