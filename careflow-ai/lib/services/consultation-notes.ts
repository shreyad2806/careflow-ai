/**
 * Consultation Notes Service
 *
 * Saves and loads doctor consultation notes and AI-generated
 * post-visit summaries from Supabase.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PostVisitSummary } from '@/lib/ai/consultation-schema';

// ============================================================
// Types
// ============================================================

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  clinicalNotes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  aiSummary: PostVisitSummary | null;
  outputLanguage: string;
  createdAt: string;
  updatedAt: string;
}

interface SaveInput {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  clinicalNotes: string;
  diagnosis: string;
  prescription: string;
  aiSummary: PostVisitSummary | null;
  language: string;
}

interface SaveResult {
  ok: true;
  noteId: string;
}

interface SaveError {
  ok: false;
  error: string;
  message: string;
}

export type SaveConsultationResult = SaveResult | SaveError;

// ============================================================
// Save consultation notes
// ============================================================

/**
 * Save or update consultation notes for an appointment.
 * Uses upsert so the doctor can save incrementally.
 */
export async function saveConsultationNotes(
  input: SaveInput
): Promise<SaveConsultationResult> {
  try {
    const supabase = createSupabaseServerClient();

    const row = {
      appointment_id: input.appointmentId,
      doctor_id: input.doctorId,
      patient_id: input.patientId,
      clinical_notes: input.clinicalNotes || null,
      diagnosis: input.diagnosis || null,
      prescription: input.prescription || null,
      ai_summary: input.aiSummary ? JSON.parse(JSON.stringify(input.aiSummary)) : null,
      output_language: input.language || 'en',
    };

    const { data, error } = await supabase
      .from('consultation_notes')
      .upsert(row, { onConflict: 'appointment_id' })
      .select('id')
      .single();

    if (error) {
      console.error('[AIAnalysis] [ConsultationNotes] ❌ Save failed:', error.message);
      return { ok: false, error: 'DATABASE_ERROR', message: `Failed to save: ${error.message}` };
    }

    console.log(`[AIAnalysis] [ConsultationNotes] ✅ Saved note id=${data.id} for appointment=${input.appointmentId}`);
    return { ok: true, noteId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AIAnalysis] [ConsultationNotes] ❌ Unexpected error: ${message}`);
    return { ok: false, error: 'UNEXPECTED_ERROR', message: 'Failed to save consultation notes.' };
  }
}

// ============================================================
// Load consultation notes for an appointment
// ============================================================

export async function getConsultationNotes(
  appointmentId: string
): Promise<ConsultationNote | null> {
  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('consultation_notes')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      appointmentId: data.appointment_id,
      doctorId: data.doctor_id,
      patientId: data.patient_id,
      clinicalNotes: data.clinical_notes,
      diagnosis: data.diagnosis,
      prescription: data.prescription,
      aiSummary: data.ai_summary as PostVisitSummary | null,
      outputLanguage: data.output_language || 'en',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}
