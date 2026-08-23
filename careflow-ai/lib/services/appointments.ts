import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppointmentRow, DoctorRow, Profile, PatientRow } from '@/lib/supabase/types';
import { mapAppointmentStatus } from '@/lib/supabase/types';
import type { Appointment } from '@/lib/types';

export async function getAppointmentsForPatient(patientId: string): Promise<Appointment[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false });

    if (error || !data || data.length === 0) return [];
    return await enrichAppointments(supabase, data as unknown as AppointmentRow[]);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    return [];
  }
}

export async function getAppointmentsForDoctor(doctorId: string): Promise<Appointment[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('appointment_date', { ascending: false });

    if (error || !data || data.length === 0) return [];
    return await enrichAppointments(supabase, data as unknown as AppointmentRow[]);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    return [];
  }
}

export async function getAllAppointments(): Promise<Appointment[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: false });

    if (error || !data || data.length === 0) return [];
    return await enrichAppointments(supabase, data as unknown as AppointmentRow[]);
  } catch (error) {
    console.error('Error fetching all appointments:', error);
    return [];
  }
}

export async function getAppointmentById(appointmentId: string): Promise<Appointment | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (error || !data) return null;
    const results = await enrichAppointments(supabase, [data as unknown as AppointmentRow]);
    return results[0] || null;
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return null;
  }
}

async function enrichAppointments(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  appointments: AppointmentRow[]
): Promise<Appointment[]> {
  if (appointments.length === 0) return [];

  const doctorIds = [...new Set(appointments.map(a => a.doctor_id))];
  const patientIds = [...new Set(appointments.map(a => a.patient_id))];

  const [{ data: doctorsData }, { data: patientsData }] = await Promise.all([
    supabase.from('doctors').select('*').in('id', doctorIds),
    supabase.from('patients').select('*').in('id', patientIds),
  ]);

  const typedDoctors = (doctorsData || []) as unknown as DoctorRow[];
  const typedPatients = (patientsData || []) as unknown as PatientRow[];

  const doctorProfileIds = typedDoctors.map(d => d.profile_id);
  const patientProfileIds = typedPatients.map(p => p.profile_id);

  const [{ data: doctorProfilesData }, { data: patientProfilesData }] = await Promise.all([
    supabase.from('profiles').select('*').in('id', doctorProfileIds),
    supabase.from('profiles').select('*').in('id', patientProfileIds),
  ]);

  const doctorProfiles = (doctorProfilesData || []) as unknown as Profile[];
  const patientProfiles = (patientProfilesData || []) as unknown as Profile[];

  const doctorProfileMap = new Map<string, Profile>();
  for (const p of doctorProfiles) doctorProfileMap.set(p.id, p);

  const patientProfileMap = new Map<string, Profile>();
  for (const p of patientProfiles) patientProfileMap.set(p.id, p);

  const doctorMap = new Map<string, { doctor: DoctorRow; profile: Profile }>();
  for (const d of typedDoctors) {
    const profile = doctorProfileMap.get(d.profile_id);
    if (profile) doctorMap.set(d.id, { doctor: d, profile });
  }

  const patientMap = new Map<string, { patient: PatientRow; profile: Profile }>();
  for (const p of typedPatients) {
    const profile = patientProfileMap.get(p.profile_id);
    if (profile) patientMap.set(p.id, { patient: p, profile });
  }

  return appointments.map(apt => {
    const doctorInfo = doctorMap.get(apt.doctor_id);
    const patientInfo = patientMap.get(apt.patient_id);

    return {
      id: apt.id,
      patientId: apt.patient_id,
      patientName: patientInfo?.profile.full_name || 'Unknown Patient',
      doctorId: apt.doctor_id,
      doctorName: doctorInfo?.profile.full_name || 'Unknown Doctor',
      specialty: doctorInfo?.doctor.speciality || '',
      date: apt.appointment_date,
      time: formatTime(apt.start_time),
      duration: calculateDuration(apt.start_time, apt.end_time),
      status: mapAppointmentStatus(apt.status),
      urgency: apt.urgency,
      reason: apt.chief_complaint || '',
      notes: undefined,
    };
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function calculateDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
