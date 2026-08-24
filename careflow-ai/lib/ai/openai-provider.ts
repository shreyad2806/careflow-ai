/**
 * OpenAI provider for AI Symptom Analysis.
 *
 * Implements the SymptomAIProvider interface using OpenAI's chat completions
 * with structured JSON output mode.
 *
 * Requirements:
 *   - OPENAI_API_KEY env var (required)
 *   - OPENAI_MODEL env var (optional, defaults to gpt-4o-mini)
 *
 * Safety:
 *   - System prompt forbids diagnoses and medical claims
 *   - Output is validated by the route before returning to client
 *   - Timeout prevents hung requests
 *   - API key never exposed to browser (server-side only)
 */

import OpenAI from 'openai';
import type {
  SymptomAIProvider,
  ProviderInput,
  ProviderResult,
} from './provider';

// ============================================================
// Configuration
// ============================================================

const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_TOKENS = 1024;

// ============================================================
// System prompt — medical safety + strict JSON output
// ============================================================

const SYSTEM_PROMPT = `You are a medical symptom triage assistant for CareFlow AI. Your role is to help patients understand which medical specialty to consult — you do NOT diagnose or treat.

CRITICAL RULES:
1. Return ONLY a valid JSON object. No markdown, no code fences, no explanation, no commentary before or after the JSON.
2. NEVER provide a diagnosis. Use phrases like "may be consistent with" or "symptoms suggest evaluation for".
3. NEVER give treatment advice. Only recommend a specialty and suggest questions for the doctor.
4. Urgency levels:
   - LOW: Routine, non-urgent symptoms that can wait for a scheduled appointment
   - MEDIUM: Symptoms needing medical attention within 1-3 days
   - HIGH: Symptoms needing same-day or next-day care, or potentially serious conditions
5. For HIGH urgency, always include a safety recommendation in patient_summary (e.g. "seek emergency care if symptoms worsen").
6. Never provide dangerous reassurance. If symptoms could indicate something serious, say so clearly.

LANGUAGE RULES:
- If the user message specifies a language, generate ALL patient-facing text in that language:
  - chief_complaint: in the patient's language
  - symptoms: in the patient's language
  - patient_summary: in the patient's language
  - suggested_questions: in the patient's language
- Keep these fields in English regardless of language:
  - urgency: always "LOW", "MEDIUM", or "HIGH" (English enum)
  - suggested_specialty: always use the standard English specialty name (e.g. "Neurology", "Cardiology")
- JSON field names (keys) are always in English.

Return exactly this JSON structure:
{
  "chief_complaint": "one-phrase summary of the primary complaint",
  "symptoms": ["identified symptom 1", "identified symptom 2"],
  "urgency": "LOW or MEDIUM or HIGH",
  "suggested_specialty": "most appropriate medical specialty",
  "patient_summary": "2-3 sentence summary for the clinician. Patient-friendly language. For HIGH urgency, include when to seek emergency care.",
  "suggested_questions": ["question 1", "question 2", "question 3"]
}

Field rules:
- chief_complaint: concise, one phrase, no diagnosis
- symptoms: list each distinct symptom, 1-8 items
- urgency: exactly LOW, MEDIUM, or HIGH (uppercase)
- suggested_specialty: e.g. "Neurology", "Cardiology", "Internal Medicine", "General Practice"
- patient_summary: clinician-facing summary, 2-3 sentences, no definitive claims
- suggested_questions: 1-5 follow-up questions a doctor should ask during consultation`;

// ============================================================
// Provider implementation
// ============================================================

/**
 * Real OpenAI provider for symptom analysis.
 *
 * Uses gpt-4o-mini by default (configurable via OPENAI_MODEL).
 * Returns raw JSON matching RawAnalysisSchema shape.
 * The route validates output before returning to client.
 */
export class OpenAIProvider implements SymptomAIProvider {
  readonly name = 'openai';

  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. Set it in .env.local for the OpenAI provider.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      // Timeout is handled per-request via AbortController
    });

    this.model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  async analyze(input: ProviderInput): Promise<ProviderResult> {
    const startTime = Date.now();

    try {
      // Build the user message from symptom input
      const userMessage = this.buildUserMessage(input);

      // Set up timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      log('info', `Calling OpenAI model=${this.model} (timeout=${REQUEST_TIMEOUT_MS}ms)`);

      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          max_tokens: MAX_TOKENS,
          temperature: 0.3, // Low temperature for consistent, safe output
        },
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Extract the response content
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        log('warn', 'OpenAI returned empty content');
        return {
          ok: false,
          error: 'EMPTY_RESPONSE',
          message: 'The AI service returned an empty response.',
        };
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        log('warn', `OpenAI returned non-JSON: ${content.slice(0, 200)}`);
        // Attempt recovery: try to extract JSON from the response
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
      log(
        'info',
        `OpenAI responded in ${elapsed}ms (tokens: ${response.usage?.total_tokens || '?'})`
      );

      return { ok: true, data: parsed as Record<string, unknown> };
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;

      // Handle AbortError (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        log('error', `OpenAI request timed out after ${elapsed}ms`);
        return {
          ok: false,
          error: 'TIMEOUT',
          message: 'The AI service took too long to respond. Please try again.',
        };
      }

      // Handle OpenAI API errors
      if (err && typeof err === 'object' && 'status' in err) {
        const apiErr = err as { status: number; message?: string };
        log(
          'error',
          `OpenAI API error: status=${apiErr.status} message=${apiErr.message || 'unknown'}`
        );

        if (apiErr.status === 401) {
          return {
            ok: false,
            error: 'AUTH_FAILED',
            message: 'AI service authentication failed. Check the API key.',
          };
        }
        if (apiErr.status === 429) {
          return {
            ok: false,
            error: 'RATE_LIMITED',
            message: 'AI service is rate-limited. Please try again in a moment.',
          };
        }
        if (apiErr.status === 500 || apiErr.status === 502 || apiErr.status === 503) {
          return {
            ok: false,
            error: 'PROVIDER_UNAVAILABLE',
            message: 'The AI service is temporarily unavailable. Please try again.',
          };
        }

        return {
          ok: false,
          error: 'PROVIDER_ERROR',
          message: `AI service error (${apiErr.status}). Please try again.`,
        };
      }

      // Handle AbortError from different runtime
      if (err instanceof DOMException && err.name === 'AbortError') {
        log('error', `OpenAI request timed out after ${elapsed}ms`);
        return {
          ok: false,
          error: 'TIMEOUT',
          message: 'The AI service took too long to respond. Please try again.',
        };
      }

      // Generic error
      const message = err instanceof Error ? err.message : String(err);
      log('error', `OpenAI unexpected error after ${elapsed}ms: ${message}`);

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

    // Language instruction
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
   * Attempt to recover JSON from malformed LLM output.
   *
   * Handles cases where the model wraps JSON in markdown fences
   * or adds trailing commentary.
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
  const prefix = '[AIAnalysis] [OpenAIProvider]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}
