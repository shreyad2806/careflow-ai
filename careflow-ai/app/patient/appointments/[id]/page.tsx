import { getAppointmentById } from '@/lib/services/appointments';
import { getDemoPatient } from '@/lib/config/demo-identity';
import AppointmentDetailContent from './AppointmentDetailContent';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  const [appointment, demoPatient] = await Promise.all([
    getAppointmentById(id),
    getDemoPatient(),
  ]);

  if (!appointment || !demoPatient) {
    notFound();
  }

  return (
    <AppointmentDetailContent
      appointment={appointment}
      patientId={demoPatient.patientId}
      userName={demoPatient.displayName}
    />
  );
}
