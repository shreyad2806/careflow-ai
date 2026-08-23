import AdminDoctorsContent from './AdminDoctorsContent';
import { fetchAllDoctors } from '@/lib/services';
import { getDemoAdmin } from '@/lib/config/demo-identity';

export default async function AdminDoctorsPage() {
  const doctors = await fetchAllDoctors();
  const demoAdmin = await getDemoAdmin();

  return (
    <AdminDoctorsContent
      doctors={doctors}
      userName={demoAdmin?.displayName ?? 'Admin'}
    />
  );
}
