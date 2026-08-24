-- CareFlow AI - Consultation Notes & Post-Visit AI Summary
-- Stores doctor-entered notes and AI-generated patient-friendly summary

CREATE TABLE consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Doctor-entered fields (source of truth)
  clinical_notes TEXT,
  diagnosis TEXT,
  prescription TEXT,

  -- AI-generated post-visit summary (structured JSONB)
  ai_summary JSONB,

  -- Language the AI summary was generated in
  output_language TEXT DEFAULT 'en' CHECK (output_language IN ('en', 'hi')),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- One consultation_notes record per appointment
  UNIQUE(appointment_id)
);

CREATE INDEX idx_consultation_notes_appointment ON consultation_notes(appointment_id);
CREATE INDEX idx_consultation_notes_doctor ON consultation_notes(doctor_id);
CREATE INDEX idx_consultation_notes_patient ON consultation_notes(patient_id);

-- Updated_at trigger
CREATE TRIGGER trigger_consultation_notes_updated_at
  BEFORE UPDATE ON consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
