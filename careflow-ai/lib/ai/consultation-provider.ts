/**
 * Post-visit AI summary generator.
 *
 * Takes doctor-entered clinical notes and generates a patient-friendly
 * summary using the Gemini provider. The output is validated against
 * PostVisitSummarySchema before returning.
 *
 * This is server-side only — never exposed to the browser.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { validatePostVisitSummary, type PostVisitSummary } from './consultation-schema';

// ============================================================
// Configuration
// ============================================================

const DEFAULT_MODEL = 'gemini-3.6-flash';
const REQUEST_TIMEOUT_MS = 30_000;

// ============================================================
// System instruction — medical safety + structured output
// ============================================================

function buildSystemInstruction(language: string): string {
  const langName = language === 'hi' ? 'Hindi' : 'English';

  return `You are a medical documentation assistant for CareFlow AI. Your role is to help doctors create a patient-friendly summary after a consultation.

CRITICAL RULES:
1. Return ONLY a valid JSON object matching the required schema. No markdown, no code fences, no explanation.
2. NEVER provide a diagnosis — rephrase the doctor's diagnosis as informational content.
3. NEVER contradict or replace the doctor's clinical notes. Use them as the source of truth.
4. Summarize in patient-friendly, non-technical language.
5. For warning_signs, include symptoms that would warrant emergency care.
6. Medications should reflect what the doctor prescribed. If no medications were prescribed, return an empty array.
7. Keep summaries concise: 3-5 sentences for patient_summary.

LANGUAGE RULES:
- Generate ALL text content in ${langName}.
- JSON field names (keys) must always be in English.
- Medical terms can remain in English if there is no common ${langName} equivalent.

Field rules:
- patient_summary: 3-5 sentence patient-friendly summary of the visit
- key_findings: list of 2-5 key clinical findings from the notes
- medications: array of prescribed medications with name, dosage, frequency, instructions (empty if none)
- follow_up_steps: list of 1-5 follow-up actions for the patient
- warning_signs: list of 1-3 warning signs that should prompt immediate medical attention`;
}

// ============================================================
// Response JSON Schema
// ============================================================

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  description: 'Post-visit patient-friendly summary generated from doctor notes',
  properties: {
    patient_summary: {
      type: Type.STRING,
      description: '3-5 sentence patient-friendly summary of the consultation',
    },
    key_findings: {
      type: Type.ARRAY,
      description: 'Key clinical findings (2-5 items)',
      items: { type: Type.STRING, description: 'A single clinical finding' },
    },
    medications: {
      type: Type.ARRAY,
      description: 'Prescribed medications (empty array if none)',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Medication name' },
          dosage: { type: Type.STRING, description: 'Dosage amount' },
          frequency: { type: Type.STRING, description: 'How often to take' },
          instructions: { type: Type.STRING, description: 'Special instructions' },
        },
        required: ['name', 'dosage', 'frequency', 'instructions'],
      },
    },
    follow_up_steps: {
      type: Type.ARRAY,
      description: 'Follow-up actions for the patient (1-5 items)',
      items: { type: Type.STRING, description: 'A single follow-up step' },
    },
    warning_signs: {
      type: Type.ARRAY,
      description: 'Warning signs requiring immediate attention (1-3 items)',
      items: { type: Type.STRING, description: 'A single warning sign' },
    },
  },
  required: ['patient_summary', 'key_findings', 'medications', 'follow_up_steps', 'warning_signs'],
} as const;

// ============================================================
// Public interface
// ============================================================

export interface GenerateSummaryInput {
  /** Doctor's clinical notes */
  clinicalNotes: string;
  /** Doctor's diagnosis */
  diagnosis: string;
  /** Doctor's prescription */
  prescription: string;
  /** Patient's preferred language */
  language: string;
}

export interface GenerateSummaryResult {
  ok: true;
  data: PostVisitSummary;
}

export interface GenerateSummaryError {
  ok: false;
  error: string;
  message: string;
}

export type GenerateSummaryOutput = GenerateSummaryResult | GenerateSummaryError;

// ============================================================
// Provider function
// ============================================================

/**
 * Generate a patient-friendly post-visit summary from doctor notes.
 *
 * Uses Gemini with structured JSON output. The result is validated
 * against PostVisitSummarySchema before returning.
 */
export async function generatePostVisitSummary(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    log('warn', 'GEMINI_API_KEY not set — cannot generate AI summary');
    return { ok: false, error: 'NO_API_KEY', message: 'AI summary service is not configured.' };
  }

  // Build the user message from doctor notes
  const userMessage = buildUserMessage(input);

  try {
    const client = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    log('info', `Calling Gemini model=${model} for post-visit summary`);

    const response = await client.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: buildSystemInstruction(input.language),
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
        abortSignal: controller.signal,
      },
    });

    clearTimeout(timeoutId);

    const content = response.text;
    if (!content) {
      log('warn', 'Gemini returned empty content for post-visit summary');
      return { ok: false, error: 'EMPTY_RESPONSE', message: 'AI service returned an empty response.' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      log('warn', `Gemini returned non-JSON: ${content.slice(0, 200)}`);
      return { ok: false, error: 'INVALID_JSON', message: 'AI service returned invalid JSON.' };
    }

    // Validate the output
    const validation = validatePostVisitSummary(parsed);
    if (!validation.ok) {
      log('warn', `AI output validation failed: ${validation.message}`);
      return { ok: false, error: validation.error, message: validation.message };
    }

    const elapsed = Date.now() - startTime;
    log('info', `Post-visit summary generated in ${elapsed}ms`);
    return { ok: true, data: validation.data };
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      log('error', `Post-visit summary timed out after ${elapsed}ms`);
      return { ok: false, error: 'TIMEOUT', message: 'AI service took too long.' };
    }

    if (err && typeof err === 'object') {
      const apiErr = err as { status?: number; code?: number; message?: string };
      const status = apiErr.status ?? apiErr.code;
      if (typeof status === 'number') {
        log('error', `Gemini API error: status=${status} message=${apiErr.message || 'unknown'}`);
        return { ok: false, error: 'PROVIDER_ERROR', message: `AI service error (${status}).` };
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    log('error', `Post-visit summary error after ${elapsed}ms: ${message}`);
    return { ok: false, error: 'PROVIDER_ERROR', message: 'AI service encountered an unexpected error.' };
  }
}

// ============================================================
// Helpers
// ============================================================

function buildUserMessage(input: GenerateSummaryInput): string {
  const parts: string[] = [];

  parts.push(`Doctor's clinical notes: "${input.clinicalNotes}"`);

  if (input.diagnosis) {
    parts.push(`Diagnosis/Assessment: "${input.diagnosis}"`);
  }
  if (input.prescription) {
    parts.push(`Prescription: "${input.prescription}"`);
  }

  return parts.join('\n');
}

// ============================================================
// Logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [ConsultationProvider]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}
