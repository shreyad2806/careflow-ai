import { getDemoPatient } from '@/lib/config/demo-identity';
import SymptomsPageContent from './SymptomsPageContent';

export default async function PatientSymptomsPage() {
  const patient = await getDemoPatient();

  return (
    <SymptomsPageContent
      patientId={patient?.patientId ?? ''}
    />
  );
}
