import { Suspense } from 'react';
import DoctorsPageContent from './DoctorsPageContent';
import { fetchDoctors } from '@/lib/services';
import { getDemoPatient } from '@/lib/config/demo-identity';

interface Props {
  searchParams: Promise<{ specialty?: string }>;
}

export default async function PatientDoctorsPage({ searchParams }: Props) {
  const [doctors, demoPatient, params] = await Promise.all([
    fetchDoctors(),
    getDemoPatient(),
    searchParams,
  ]);

  const recommendedSpecialty = params.specialty || null;

  // Dev diagnostic
  if (recommendedSpecialty) {
    console.log(
      `[AIAnalysis] [PatientDoctors] ✅ Recommended specialty from AI analysis: "${recommendedSpecialty}" → ${doctors.length} doctors loaded`
    );
  }

  return (
    <Suspense fallback={null}>
      <DoctorsPageContent
        doctors={doctors}
        userName={demoPatient?.displayName ?? 'Patient'}
        recommendedSpecialty={recommendedSpecialty}
      />
    </Suspense>
  );
}
