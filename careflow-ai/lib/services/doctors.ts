import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DoctorRow, Profile } from '@/lib/supabase/types';
import { mapDoctorToFrontend } from '@/lib/supabase/types';
import type { Doctor } from '@/lib/types';

export async function getDoctors(): Promise<Doctor[]> {
  try {
    const supabase = createSupabaseServerClient();

    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (doctorsError || !doctors || doctors.length === 0) {
      console.error('Error fetching doctors:', doctorsError);
      return [];
    }

    const typedDoctors = doctors as unknown as DoctorRow[];
    const profileIds = typedDoctors.map(d => d.profile_id);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }

    const typedProfiles = profiles as unknown as Profile[];
    const profileMap = new Map<string, Profile>();
    for (const p of typedProfiles) {
      profileMap.set(p.id, p);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const { data: availabilities } = await supabase
      .from('doctor_availability')
      .select('*')
      .in('doctor_id', typedDoctors.map(d => d.id));

    const availabilityMap = new Map<string, string[]>();
    if (availabilities) {
      for (const a of availabilities as unknown as Array<{ doctor_id: string; day_of_week: number }>) {
        const existing = availabilityMap.get(a.doctor_id) || [];
        existing.push(dayNames[a.day_of_week]);
        availabilityMap.set(a.doctor_id, existing);
      }
    }

    return typedDoctors.map(doctor => {
      const profile = profileMap.get(doctor.profile_id);
      if (!profile) return null;
      const mapped = mapDoctorToFrontend(doctor, profile);
      return { ...mapped, availability: availabilityMap.get(doctor.id) || [] };
    }).filter(Boolean) as Doctor[];
  } catch (error) {
    console.error('Unexpected error fetching doctors:', error);
    return [];
  }
}

export async function getDoctorById(doctorId: string): Promise<Doctor | null> {
  try {
    const supabase = createSupabaseServerClient();

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (doctorError || !doctor) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', (doctor as unknown as DoctorRow).profile_id)
      .single();

    if (profileError || !profile) return null;

    return mapDoctorToFrontend(doctor as unknown as DoctorRow, profile as unknown as Profile) as Doctor;
  } catch (error) {
    console.error('Unexpected error fetching doctor:', error);
    return null;
  }
}

export async function getDoctorsForAdmin() {
  try {
    const supabase = createSupabaseServerClient();

    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .order('created_at', { ascending: true });

    if (doctorsError || !doctors) return [];

    const typedDoctors = doctors as unknown as DoctorRow[];
    const profileIds = typedDoctors.map(d => d.profile_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    if (!profiles) return [];

    const typedProfiles = profiles as unknown as Profile[];
    const profileMap = new Map<string, Profile>();
    for (const p of typedProfiles) profileMap.set(p.id, p);

    return typedDoctors.map(doctor => {
      const profile = profileMap.get(doctor.profile_id);
      if (!profile) return null;
      return mapDoctorToFrontend(doctor, profile);
    }).filter(Boolean);
  } catch (error) {
    console.error('Unexpected error fetching doctors for admin:', error);
    return [];
  }
}
