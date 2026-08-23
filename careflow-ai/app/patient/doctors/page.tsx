import DoctorsPageContent from './DoctorsPageContent';
import { fetchDoctors } from '@/lib/services';
import { getDemoPatient } from '@/lib/config/demo-identity';

export default async function PatientDoctorsPage() {
  const doctors = await fetchDoctors();
  const demoPatient = await getDemoPatient();

  return (
    <DoctorsPageContent
      doctors={doctors}
      userName={demoPatient?.displayName ?? 'Patient'}
    />
  );
}
