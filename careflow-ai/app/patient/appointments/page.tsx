import AppointmentsPageContent from './AppointmentsPageContent';
import { fetchAppointmentsForPatient } from '@/lib/services';
import { getDemoPatient } from '@/lib/config/demo-identity';

export default async function PatientAppointmentsPage() {
  const demoPatient = await getDemoPatient();

  // Fallback to empty array if demo patient not found in DB
  const appointments = demoPatient
    ? await fetchAppointmentsForPatient(demoPatient.patientId)
    : [];

  return (
    <AppointmentsPageContent
      appointments={appointments}
      userName={demoPatient?.displayName ?? 'Patient'}
    />
  );
}
