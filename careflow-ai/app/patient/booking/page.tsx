import { fetchDoctors } from '@/lib/services/index';
import { getAppointmentById } from '@/lib/services/appointments';
import { getDemoPatient } from '@/lib/config/demo-identity';
import BookingPageContent from './BookingPageContent';

interface Props {
  searchParams: Promise<{ reschedule?: string; doctorId?: string }>;
}

export default async function PatientBookingPage({ searchParams }: Props) {
  const params = await searchParams;
  const rescheduleId = params.reschedule;
  const preselectedDoctorId = params.doctorId;

  const [doctors, patient, rescheduleAppointment] = await Promise.all([
    fetchDoctors(),
    getDemoPatient(),
    rescheduleId ? getAppointmentById(rescheduleId) : Promise.resolve(null),
  ]);

  const patientName = patient?.displayName ?? 'Patient';
  const patientId = patient?.patientId ?? '';

  return (
    <BookingPageContent
      userName={patientName}
      patientId={patientId}
      doctors={doctors}
      rescheduleAppointment={rescheduleAppointment}
      preselectedDoctorId={preselectedDoctorId}
    />
  );
}
