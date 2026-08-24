/**
 * Validation and mapping utilities for AI Symptom Analysis.
 *
 * Provides:
 *   1. validateAnalysis() — validates raw LLM output into a typed result
 *   2. toAnalysisInsertRow() — maps validated result to DB insert shape
 *   3. FALLBACK_RESULT — safe defaults when validation fails
 *
 * Usage:
 *   import { validateAnalysis, toAnalysisInsertRow } from '@/lib/ai/validate';
 *
 *   const result = validateAnalysis(rawLLMOutput);
 *   if (result.ok) {
 *     const row = toAnalysisInsertRow(result.data, patientId, 'en', rawLLMOutput);
 *     await supabase.from('ai_analyses').insert(row);
 *   } else {
 *     console.error(result.error, result.message);
 *   }
 */

import { RawAnalysisSchema } from './schema';
import type {
  SymptomAnalysisResult,
  AnalysisValidationResult,
  AnalysisLanguage,
  AIAnalysisInsertRow,
} from './types';

// ============================================================
// Validation
// ============================================================

/**
 * Validate raw LLM output into a typed SymptomAnalysisResult.
 *
 * Accepts any unknown value (the raw JSON parsed from the LLM response).
 * Returns a discriminated union: { ok: true, data } | { ok: false, error, message }.
 *
 * Handles:
 *   - Null/undefined input
 *   - Non-object input
 *   - Missing or empty fields
 *   - Invalid urgency values
 *   - Too few or too many questions
 *   - Single strings instead of arrays
 *   - Mixed-case urgency values
 */
export function validateAnalysis(raw: unknown): AnalysisValidationResult {
  // --- Guard: null / undefined / wrong type ---
  if (raw === null || raw === undefined) {
    return {
      ok: false,
      error: 'STRUCTURE_MISMATCH',
      message: 'AI returned no data.',
      raw,
    };
  }

  if (typeof raw !== 'object') {
    return {
      ok: false,
      error: 'STRUCTURE_MISMATCH',
      message: `AI returned ${typeof raw} instead of an object.`,
      raw,
    };
  }

  // --- Validate with Zod ---
  const parsed = RawAnalysisSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const field = firstError?.path?.join('.') || 'unknown';
    const issue = firstError?.message || 'Invalid value';

    // Map Zod errors to domain error codes
    let code: AnalysisValidationResult extends { ok: false; error: infer E } ? E : never;
    if (field.includes('urgency')) {
      code = 'INVALID_URGENCY' as typeof code;
    } else if (field.includes('chief_complaint')) {
      code = 'EMPTY_CHIEF_COMPLAINT' as typeof code;
    } else if (field.includes('symptoms')) {
      code = 'EMPTY_SYMPTOMS' as typeof code;
    } else if (field.includes('suggested_specialty')) {
      code = 'EMPTY_SPECIALTY' as typeof code;
    } else if (field.includes('patient_summary')) {
      code = 'EMPTY_SUMMARY' as typeof code;
    } else if (field.includes('suggested_questions')) {
      code = 'INVALID_QUESTIONS' as typeof code;
    } else {
      code = 'STRUCTURE_MISMATCH' as typeof code;
    }

    return {
      ok: false,
      error: code,
      message: `Validation failed at "${field}": ${issue}`,
      raw,
    };
  }

  // --- Map raw snake_case to canonical camelCase ---
  const data: SymptomAnalysisResult = {
    chiefComplaint: parsed.data.chief_complaint,
    symptoms: parsed.data.symptoms,
    urgency: parsed.data.urgency,
    suggestedSpecialty: parsed.data.suggested_specialty,
    patientSummary: parsed.data.patient_summary,
    suggestedQuestions: parsed.data.suggested_questions,
  };

  return { ok: true, data };
}

// ============================================================
// Safe fallback
// ============================================================

/**
 * Safe fallback result when AI output is invalid or unavailable.
 *
 * Uses conservative defaults:
 *   - Urgency: MEDIUM (needs attention, but not emergency)
 *   - Specialty: General Practice (safe default referral)
 *   - Empty questions (doctor must assess independently)
 *
 * The caller should still persist this as a record that analysis
 * failed, so the doctor knows to rely on their own assessment.
 */
export const FALLBACK_RESULT: SymptomAnalysisResult = {
  chiefComplaint: 'Symptom analysis unavailable',
  symptoms: ['Unable to analyze symptoms automatically'],
  urgency: 'MEDIUM',
  suggestedSpecialty: 'General Practice',
  patientSummary:
    'The AI symptom analysis could not be completed. ' +
    'Please consult with a general practitioner for a manual assessment.',
  suggestedQuestions: [
    'Can you describe your symptoms in your own words?',
    'When did the symptoms first start?',
    'Have you experienced these symptoms before?',
  ],
};

// ============================================================
// DB mapping
// ============================================================

/**
 * Map a validated SymptomAnalysisResult to an ai_analyses INSERT row.
 *
 * @param result     - The validated analysis result
 * @param patientId  - The patient's UUID (from patients table)
 * @param language   - The input language ('en' | 'hi')
 * @param rawResponse - The original raw LLM output (for audit trail)
 * @returns An object ready for supabase.from('ai_analyses').insert()
 */
export function toAnalysisInsertRow(
  result: SymptomAnalysisResult,
  patientId: string,
  language: AnalysisLanguage,
  rawResponse?: unknown
): AIAnalysisInsertRow {
  return {
    patient_id: patientId,
    input_language: language,
    symptoms: result.symptoms,
    urgency: result.urgency.toLowerCase(),
    chief_complaint: result.chiefComplaint,
    suggested_speciality: result.suggestedSpecialty,
    patient_summary: result.patientSummary,
    suggested_questions: result.suggestedQuestions,
    raw_response: (rawResponse as Record<string, unknown>) ?? null,
  };
}
