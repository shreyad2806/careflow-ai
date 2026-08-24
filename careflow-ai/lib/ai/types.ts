/**
 * Canonical types for AI Symptom Analysis.
 *
 * Single source of truth for the analysis contract between:
 *   - The LLM prompt (raw output)
 *   - The validation layer (schema)
 *   - The database (ai_analyses table)
 *   - The frontend (display)
 *
 * These types are decoupled from both the LLM provider and the database.
 * The validation layer maps between raw LLM output and these types.
 * The service layer maps between these types and the DB insert types.
 */

// ============================================================
// Urgency — strict uppercase enum (no 'critical' at this level)
// ============================================================

/** Urgency levels the AI can assign. Uppercase for contract clarity. */
export type AnalysisUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

// ============================================================
// Input: what the service sends to the LLM
// ============================================================

/** Structured symptom input from the patient intake form. */
export interface SymptomInput {
  /** Free-text symptom description from the patient. */
  description: string;
  /** Selected symptom category (e.g. 'Head & Neck', 'Chest & Heart'). */
  category?: string;
  /** Duration of symptoms (e.g. '3 days', '1-2 weeks'). */
  duration?: string;
  /** Severity level (e.g. 'Mild', 'Moderate', 'Severe'). */
  severity?: string;
  /** Additional symptoms the patient selected (e.g. ['Fever', 'Nausea']). */
  additionalSymptoms?: string[];
}

/** Supported input languages. Matches profiles.preferred_language. */
export type AnalysisLanguage = 'en' | 'hi';

// ============================================================
// Output: the validated analysis result
// ============================================================

/**
 * Canonical analysis result.
 *
 * After validation, every field is guaranteed to be present and non-empty.
 * Maps 1:1 to the ai_analyses DB columns:
 *   chief_complaint    → chiefComplaint
 *   suggested_speciality → suggestedSpecialty
 *   patient_summary    → patientSummary
 *   suggested_questions → suggestedQuestions
 *   symptoms           → symptoms (string[])
 *   urgency            → urgency (AnalysisUrgency)
 */
export interface SymptomAnalysisResult {
  /** Patient's primary complaint, summarized in one phrase. */
  chiefComplaint: string;
  /** Structured list of identified symptoms. */
  symptoms: string[];
  /** Urgency classification. */
  urgency: AnalysisUrgency;
  /** Recommended medical specialty for consultation. */
  suggestedSpecialty: string;
  /** Clinician-facing summary of the patient's presentation. */
  patientSummary: string;
  /** 1–5 follow-up questions for the doctor to ask during consultation. */
  suggestedQuestions: string[];
}

// ============================================================
// Validation result — discriminated union
// ============================================================

/** Analysis validated successfully. */
export interface AnalysisSuccess {
  ok: true;
  data: SymptomAnalysisResult;
}

/** Analysis validation failed or LLM output was malformed. */
export interface AnalysisError {
  ok: false;
  error: AnalysisErrorCode;
  /** Human-readable error message (safe to display). */
  message: string;
  /** The raw LLM output that failed validation (for debugging). */
  raw?: unknown;
}

export type AnalysisErrorCode =
  | 'EMPTY_INPUT'
  | 'INVALID_URGENCY'
  | 'EMPTY_CHIEF_COMPLAINT'
  | 'EMPTY_SYMPTOMS'
  | 'EMPTY_SPECIALTY'
  | 'EMPTY_SUMMARY'
  | 'INVALID_QUESTIONS'
  | 'STRUCTURE_MISMATCH'
  | 'UNKNOWN';

/** The full validation result type. */
export type AnalysisValidationResult = AnalysisSuccess | AnalysisError;

// ============================================================
// DB mapping
// ============================================================

/**
 * Maps a validated result to an ai_analyses INSERT row.
 * Excludes auto-generated fields (id, created_at).
 */
export interface AIAnalysisInsertRow {
  patient_id: string;
  input_language: AnalysisLanguage;
  symptoms: string[];
  urgency: string;
  chief_complaint: string;
  suggested_speciality: string;
  patient_summary: string;
  suggested_questions: string[];
  raw_response: Record<string, unknown> | null;
}
