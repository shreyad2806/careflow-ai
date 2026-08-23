import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DoctorLeave, Profile } from '@/lib/supabase/types';
import type { LeaveRequest } from '@/lib/types';

export async function getDoctorLeaves(): Promise<LeaveRequest[]> {
  try {
    const supabase = createSupabaseServerClient();

    const { data: leaves, error: leavesError } = await supabase
      .from('doctor_leaves')
      .select('*')
      .order('created_at', { ascending: false });

    if (leavesError || !leaves || leaves.length === 0) return [];

    const typedLeaves = leaves as unknown as DoctorLeave[];
    const doctorIds = [...new Set(typedLeaves.map(l => l.doctor_id))];

    const { data: doctors } = await supabase
      .from('doctors')
      .select('id, profile_id')
      .in('id', doctorIds);

    if (!doctors) return [];

    const typedDoctors = doctors as unknown as Array<{ id: string; profile_id: string }>;
    const profileIds = typedDoctors.map(d => d.profile_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    if (!profiles) return [];

    const typedProfiles = profiles as unknown as Profile[];
    const profileMap = new Map<string, string>();
    for (const d of typedDoctors) {
      const p = typedProfiles.find(pr => pr.id === d.profile_id);
      if (p) profileMap.set(d.id, p.full_name);
    }

    return typedLeaves.map(leave => ({
      id: leave.id,
      doctorId: leave.doctor_id,
      doctorName: profileMap.get(leave.doctor_id) || 'Unknown Doctor',
      startDate: leave.start_date,
      endDate: leave.end_date,
      reason: leave.reason || '',
      status: leave.status as 'pending' | 'approved' | 'rejected',
      requestedAt: leave.created_at.split('T')[0],
    }));
  } catch (error) {
    console.error('Error fetching doctor leaves:', error);
    return [];
  }
}
