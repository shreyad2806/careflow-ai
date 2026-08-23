import DoctorDashboardContent from './DoctorDashboardContent';
import { fetchAppointmentsForDoctor } from '@/lib/services';
import { getDemoDoctor } from '@/lib/config/demo-identity';

export default async function DoctorDashboardPage() {
  const demoDoctor = await getDemoDoctor();

  // Fallback to empty array if demo doctor not found in DB
  const appointments = demoDoctor
    ? await fetchAppointmentsForDoctor(demoDoctor.doctorId)
    : [];

  return (
    <DoctorDashboardContent
      appointments={appointments}
      doctorId={demoDoctor?.doctorId ?? ''}
      userName={demoDoctor?.displayName ?? 'Doctor'}
    />
  );
}
