/**
 * Google Gemini provider for AI Symptom Analysis.
 *
 * Implements the SymptomAIProvider interface using the Google GenAI SDK
 * (@google/genai) with structured JSON output mode.
 *
 * Requirements:
 *   - GEMINI_API_KEY env var (required)
 *   - GEMINI_MODEL env var (optional, defaults to gemini-2.5-flash)
 *
 * Safety:
 *   - System instruction forbids diagnoses and medical claims
 *   - Output is validated by the route via RawAnalysisSchema before returning
 *   - Timeout prevents hung requests
 *   - API key never exposed to browser (server-side only)
 *   - Structured JSON output enforced via responseJsonSchema
 */

import { GoogleGenAI, Type } from '@google/genai';
import type {
  SymptomAIProvider,
  ProviderInput,
  ProviderResult,
} from './provider';

// ============================================================
// Configuration
// ============================================================

const DEFAULT_MODEL = 'gemini-3.6-flash';
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

// ============================================================
// System instruction — medical safety + strict JSON output
// ============================================================

const SYSTEM_INSTRUCTION = `You are a medical symptom triage assistant for CareFlow AI. Your role is to help patients understand which medical specialty to consult — you do NOT diagnose or treat.

CRITICAL RULES:
1. Return ONLY a valid JSON object matching the required schema. No markdown, no code fences, no explanation, no commentary before or after the JSON.
2. NEVER provide a diagnosis. Use phrases like "may be consistent with" or "symptoms suggest evaluation for".
3. NEVER give treatment advice. Only recommend a specialty and suggest questions for the doctor.
4. NEVER prescribe medication or recommend specific drugs.
5. Urgency levels:
   - LOW: Routine, non-urgent symptoms that can wait for a scheduled appointment
   - MEDIUM: Symptoms needing medical attention within 1-3 days
   - HIGH: Symptoms needing same-day or next-day care, or potentially serious conditions
6. For HIGH urgency, always include a safety recommendation in patient_summary (e.g. "seek emergency care if symptoms worsen").
7. Never provide dangerous reassurance. If symptoms could indicate something serious, say so clearly.
8. This is informational assistance only — not a medical diagnosis. Do not claim certainty about any condition.

LANGUAGE RULES:
- If the user message specifies a language, generate ALL patient-facing text in that language:
  - chief_complaint: in the patient's language
  - symptoms: in the patient's language
  - patient_summary: in the patient's language
  - suggested_questions: in the patient's language
- Keep these fields in English regardless of language:
  - urgency: always "LOW", "MEDIUM", or "HIGH" (English enum)
  - suggested_specialty: always use the standard English specialty name (e.g. "Neurology", "Cardiology")
- JSON field names (keys) are always in English.`;

// ============================================================
// Response JSON Schema — enforces structured output from Gemini
// ============================================================

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  description: 'Structured symptom analysis result for a patient',
  properties: {
    chief_complaint: {
      type: Type.STRING,
      description: 'One-phrase summary of the primary complaint',
    },
    symptoms: {
      type: Type.ARRAY,
      description: 'List of identified symptoms (1-8 items)',
      items: {
        type: Type.STRING,
        description: 'A single identified symptom',
      },
    },
    urgency: {
      type: Type.STRING,
      description: 'Urgency level: LOW, MEDIUM, or HIGH',
      enum: ['LOW', 'MEDIUM', 'HIGH'],
    },
    suggested_specialty: {
      type: Type.STRING,
      description: 'Most appropriate medical specialty for consultation',
    },
    patient_summary: {
      type: Type.STRING,
      description: '2-3 sentence clinician-facing summary in patient-friendly language. For HIGH urgency, include when to seek emergency care.',
    },
    suggested_questions: {
      type: Type.ARRAY,
      description: '1-5 follow-up questions a doctor should ask during consultation',
      items: {
        type: Type.STRING,
        description: 'A single follow-up question',
      },
    },
  },
  required: [
    'chief_complaint',
    'symptoms',
    'urgency',
    'suggested_specialty',
    'patient_summary',
    'suggested_questions',
  ],
} as const;

// ============================================================
// Provider implementation
// ============================================================

/**
 * Real Google Gemini provider for symptom analysis.
 *
 * Uses gemini-2.5-flash by default (configurable via GEMINI_MODEL).
 * Returns structured JSON matching RawAnalysisSchema shape via
 * the responseJsonSchema config.
 * The route validates output before returning to client.
 */
export class GeminiSymptomProvider implements SymptomAIProvider {
  readonly name = 'gemini';

  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required. Set it in .env.local for the Gemini provider.'
      );
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async analyze(input: ProviderInput): Promise<ProviderResult> {
    const startTime = Date.now();

    try {
      const userMessage = this.buildUserMessage(input);

      // Set up timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      log('info', `Calling Gemini model=${this.model} (timeout=${REQUEST_TIMEOUT_MS}ms)`);

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.3,
          abortSignal: controller.signal,
        },
      });

      clearTimeout(timeoutId);

      // Extract the text content
      const content = response.text;
      if (!content) {
        log('warn', 'Gemini returned empty content');
        return {
          ok: false,
          error: 'EMPTY_RESPONSE',
          message: 'The AI service returned an empty response.',
        };
      }

      // Parse JSON (should already be valid JSON due to responseMimeType,
      // but we parse defensively in case of SDK edge cases)
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        log('warn', `Gemini returned non-JSON: ${content.slice(0, 200)}`);
        parsed = this.attemptJsonRecovery(content);
        if (!parsed) {
          return {
            ok: false,
            error: 'INVALID_JSON',
            message: 'The AI service returned invalid JSON.',
          };
        }
      }

      const elapsed = Date.now() - startTime;
      log('info', `Gemini responded in ${elapsed}ms`);

      return { ok: true, data: parsed as Record<string, unknown> };
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;

      // Handle AbortError (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        log('error', `Gemini request timed out after ${elapsed}ms`);
        return {
          ok: false,
          error: 'TIMEOUT',
          message: 'The AI service took too long to respond. Please try again.',
        };
      }

      // Handle Gemini API errors (check for status/code in error object)
      if (err && typeof err === 'object') {
        const apiErr = err as { status?: number; code?: number; message?: string };

        // HTTP status from REST API
        const status = apiErr.status ?? apiErr.code;
        if (typeof status === 'number') {
          // Log the real API message (may contain model deprecation info, etc.)
          log(
            'error',
            `Gemini API error: status=${status} message=${apiErr.message || 'unknown'}`
          );

          // If the error message contains a model suggestion, log it clearly
          if (apiErr.message && apiErr.message.includes('no longer available')) {
            log(
              'error',
              `Model "${this.model}" is deprecated. Update GEMINI_MODEL env var or default. API suggests: ${apiErr.message}`
            );
          }

          if (status === 401 || status === 403) {
            return {
              ok: false,
              error: 'AUTH_FAILED',
              message: 'AI service authentication failed. Check the API key.',
            };
          }
          if (status === 429) {
            return {
              ok: false,
              error: 'RATE_LIMITED',
              message: 'AI service is rate-limited. Please try again in a moment.',
            };
          }
          if (status === 500 || status === 502 || status === 503) {
            return {
              ok: false,
              error: 'PROVIDER_UNAVAILABLE',
              message: 'The AI service is temporarily unavailable. Please try again.',
            };
          }

          return {
            ok: false,
            error: 'PROVIDER_ERROR',
            message: `AI service error (${status}). Please try again.`,
          };
        }
      }

      // Generic error — capture the full error for debugging
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      log('error', `Gemini unexpected error after ${elapsed}ms: ${message}`);
      if (stack) {
        log('error', `Stack: ${stack.split('\n').slice(0, 5).join(' | ')}`);
      }

      return {
        ok: false,
        error: 'PROVIDER_ERROR',
        message: 'The AI service encountered an unexpected error.',
      };
    }
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  /** Build the user message from structured symptom input. */
  private buildUserMessage(input: ProviderInput): string {
    const parts: string[] = [];

    parts.push(`Patient symptom description: "${input.symptoms.description}"`);

    if (input.symptoms.category) {
      parts.push(`Symptom category: ${input.symptoms.category}`);
    }
    if (input.symptoms.duration) {
      parts.push(`Duration: ${input.symptoms.duration}`);
    }
    if (input.symptoms.severity) {
      parts.push(`Severity: ${input.symptoms.severity}`);
    }
    if (
      input.symptoms.additionalSymptoms &&
      input.symptoms.additionalSymptoms.length > 0
    ) {
      parts.push(
        `Additional symptoms: ${input.symptoms.additionalSymptoms.join(', ')}`
      );
    }

    // Language instruction — tells the model which language to generate content in
    const langCode = input.language || 'en';
    const langName = langCode === 'hi' ? 'Hindi' : 'English';
    parts.push(
      `IMPORTANT: Generate ALL patient-facing text (chief_complaint, symptoms, patient_summary, suggested_questions) in ${langName}. ` +
      `Keep urgency as English enum (LOW/MEDIUM/HIGH) and suggested_specialty as English specialty name. ` +
      `JSON field names must be in English.`
    );

    return parts.join('\n');
  }

  /**
   * Attempt to recover JSON from malformed output.
   *
   * Defensive fallback in case responseJsonSchema enforcement
   * doesn't work perfectly (e.g., SDK or API edge cases).
   */
  private attemptJsonRecovery(content: string): Record<string, unknown> | null {
    // Try to extract JSON from markdown code fences
    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (typeof parsed === 'object' && parsed !== null) {
          log('info', 'Recovered JSON from markdown code fence');
          return parsed;
        }
      } catch {
        // Fall through
      }
    }

    // Try to find a JSON object in the text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed === 'object' && parsed !== null) {
          log('info', 'Recovered JSON from embedded object');
          return parsed;
        }
      } catch {
        // Fall through
      }
    }

    return null;
  }
}

// ============================================================
// Dev logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [GeminiProvider]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}
