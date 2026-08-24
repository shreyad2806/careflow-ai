import AdminLeavesContent from './AdminLeavesContent';
import { getDoctorsForAdmin } from '@/lib/services/doctors';
import { getDoctorLeaves } from '@/lib/services/leaves';
import { getDemoAdmin } from '@/lib/config/demo-identity';

export default async function AdminLeavesPage() {
  const [doctors, leaves, demoAdmin] = await Promise.all([
    getDoctorsForAdmin(),
    getDoctorLeaves(),
    getDemoAdmin(),
  ]);

  return (
    <AdminLeavesContent
      doctors={doctors.filter(Boolean) as import('@/lib/types').Doctor[]}
      leaves={leaves}
      userName={demoAdmin?.displayName ?? 'Admin'}
    />
  );
}
