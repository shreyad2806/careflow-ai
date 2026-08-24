import { notFound } from 'next/navigation';
import { getAppointmentById } from '@/lib/services/appointments';
import { getConsultationNotes } from '@/lib/services/consultation-notes';
import { getDemoDoctor } from '@/lib/config/demo-identity';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import DoctorConsultationContent from './DoctorConsultationContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DoctorConsultationPage({ params }: Props) {
  const { id } = await params;
  const [appointment, demoDoctor, existingNotes] = await Promise.all([
    getAppointmentById(id),
    getDemoDoctor(),
    getConsultationNotes(id),
  ]);

  if (!appointment || !demoDoctor) {
    notFound();
  }

  // Fetch pre-visit AI analysis if linked
  let preVisitAnalysis: {
    urgency: string;
    chiefComplaint: string | null;
    symptoms: string[];
    patientSummary: string | null;
    suggestedQuestions: string[];
  } | null = null;

  // Try to load from ai_analyses via the appointment's linked patient
  try {
    const supabase = createSupabaseServerClient();
    const { data: analysis } = await supabase
      .from('ai_analyses')
      .select('urgency, chief_complaint, symptoms, patient_summary, suggested_questions')
      .eq('patient_id', appointment.patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (analysis) {
      preVisitAnalysis = {
        urgency: analysis.urgency || 'medium',
        chiefComplaint: analysis.chief_complaint,
        symptoms: Array.isArray(analysis.symptoms) ? analysis.symptoms : [],
        patientSummary: analysis.patient_summary,
        suggestedQuestions: Array.isArray(analysis.suggested_questions) ? analysis.suggested_questions : [],
      };
    }
  } catch {
    // No analysis found — will show fallback
  }

  // Fetch patient profile for name
  let patientName = 'Patient';
  try {
    const supabase = createSupabaseServerClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', appointment.patientId)
      .single();
    if (profile) patientName = profile.full_name;
  } catch {
    // Use fallback
  }

  return (
    <DoctorConsultationContent
      appointmentId={appointment.id}
      doctorId={demoDoctor.doctorId}
      patientId={appointment.patientId}
      patientName={patientName}
      doctorName={demoDoctor.displayName}
      appointmentDate={appointment.date}
      appointmentTime={appointment.time}
      appointmentUrgency={appointment.urgency}
      appointmentReason={appointment.reason}
      preVisitAnalysis={preVisitAnalysis}
      existingNotes={existingNotes}
      outputLanguage={existingNotes?.outputLanguage || 'en'}
    />
  );
}
