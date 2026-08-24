/**
 * AI Analysis persistence service.
 *
 * Saves validated SymptomAnalysisResult to the ai_analyses table.
 * Only accepts data that has already passed schema validation.
 * Never stores raw API keys or provider secrets.
 *
 * Flow:
 *   1. Route validates request body
 *   2. Provider generates analysis
 *   3. Route validates provider output
 *   4. THIS SERVICE persists to Supabase
 *   5. Route returns result to client
 *
 * The raw_response column stores the AI provider's output for audit trail.
 * This is medical analysis text, not secrets.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toAnalysisInsertRow } from '@/lib/ai/validate';
import type {
  SymptomAnalysisResult,
  AnalysisLanguage,
  AIAnalysisInsertRow,
} from '@/lib/ai/types';

// ============================================================
// Domain result types
// ============================================================

/** Persistence succeeded. */
export interface PersistSuccess {
  ok: true;
  /** The UUID of the created ai_analyses row. */
  analysisId: string;
  /** The validated analysis data that was saved. */
  data: SymptomAnalysisResult;
}

/** Persistence failed. */
export interface PersistError {
  ok: false;
  error: PersistErrorCode;
  message: string;
}

export type PersistErrorCode =
  | 'MISSING_PATIENT_ID'
  | 'DATABASE_ERROR';

export type PersistResult = PersistSuccess | PersistError;

// ============================================================
// Dev logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [ai-analysis]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// Core service function
// ============================================================

/**
 * Persist a validated AI analysis to the ai_analyses table.
 *
 * Only accepts SymptomAnalysisResult that has already passed
 * RawAnalysisSchema validation. The toAnalysisInsertRow helper
 * maps camelCase fields to the DB snake_case columns.
 *
 * @param result      - The validated analysis (must be ok: true)
 * @param patientId   - The patient's UUID (from patients table)
 * @param language    - The input language ('en' | 'hi')
 * @param rawResponse - The raw provider output (for audit trail)
 * @returns PersistResult with the created row's ID
 */
export async function saveAnalysis(
  result: SymptomAnalysisResult,
  patientId: string,
  language: AnalysisLanguage,
  rawResponse?: unknown
): Promise<PersistResult> {
  // --- Validate inputs ---
  if (!patientId) {
    log('warn', 'saveAnalysis called without patientId');
    return {
      ok: false,
      error: 'MISSING_PATIENT_ID',
      message: 'Patient ID is required to save analysis.',
    };
  }

  // --- Map to DB row ---
  const row: AIAnalysisInsertRow = toAnalysisInsertRow(
    result,
    patientId,
    language,
    rawResponse
  );

  log(
    'info',
    `Saving analysis: patient=${patientId} urgency=${result.urgency} specialty=${result.suggestedSpecialty}`
  );

  // --- Insert into Supabase ---
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('ai_analyses')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    log('error', `Insert failed: ${error.message} (code=${error.code})`);
    return {
      ok: false,
      error: 'DATABASE_ERROR',
      message: `Failed to save analysis: ${error.message}`,
    };
  }

  const analysisId = data?.id;
  log('info', `Analysis saved: id=${analysisId}`);

  return {
    ok: true,
    analysisId,
    data: result,
  };
}

// ============================================================
// Read helper (for future use)
// ============================================================

/**
 * Fetch all analyses for a patient, most recent first.
 * Read-only — does not modify any data.
 */
export async function getAnalysesForPatient(
  patientId: string
): Promise<SymptomAnalysisResult[]> {
  if (!patientId) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (error) log('error', `Read failed: ${error.message}`);
    return [];
  }

  return data.map((row) => ({
    chiefComplaint: row.chief_complaint || '',
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    urgency: (row.urgency?.toUpperCase() || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
    suggestedSpecialty: row.suggested_speciality || '',
    patientSummary: row.patient_summary || '',
    suggestedQuestions: Array.isArray(row.suggested_questions)
      ? row.suggested_questions
      : [],
  }));
}
