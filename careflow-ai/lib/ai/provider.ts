/**
 * Abstract interface for AI symptom analysis providers.
 *
 * Any provider (mock, OpenAI, Anthropic, etc.) implements this interface.
 * The API route calls the provider and validates its output.
 *
 * The provider returns raw JSON — the route validates it against
 * RawAnalysisSchema before returning to the client.
 *
 * Design: the provider does NOT persist to the database.
 * Persistence is the route's responsibility (not yet implemented).
 */

import type { SymptomInput, AnalysisLanguage } from './types';

// ============================================================
// Provider input — what the route sends to the provider
// ============================================================

/**
 * Input to the AI provider.
 * Extends SymptomInput with language preference.
 */
export interface ProviderInput {
  /** Structured symptom data from the patient intake form. */
  symptoms: SymptomInput;
  /** Patient's preferred language for the analysis. */
  language: AnalysisLanguage;
}

// ============================================================
// Provider output — raw JSON to be validated
// ============================================================

/**
 * Raw output from the provider.
 *
 * Must match the shape expected by RawAnalysisSchema:
 *   { chief_complaint, symptoms, urgency, suggested_specialty,
 *     patient_summary, suggested_questions }
 *
 * The route validates this before returning to the client.
 * The provider does NOT need to validate its own output.
 */
// deno-lint-ignore no-explicit-any
export type ProviderOutput = Record<string, any>;

// ============================================================
// Provider result — discriminated union
// ============================================================

/** Provider succeeded. */
export interface ProviderSuccess {
  ok: true;
  /** Raw JSON output matching RawAnalysisSchema shape. */
  data: ProviderOutput;
}

/** Provider failed. */
export interface ProviderFailure {
  ok: false;
  /** Error code for programmatic handling. */
  error: string;
  /** Human-readable error message (safe to display). */
  message: string;
}

export type ProviderResult = ProviderSuccess | ProviderFailure;

// ============================================================
// Provider interface
// ============================================================

/**
 * SymptomAIProvider — the contract for all AI providers.
 *
 * Implementations:
 *   - MockProvider (lib/ai/mock-provider.ts) — deterministic, keyword-based
 *   - OpenAIProvider (future) — calls OpenAI API
 *   - AnthropicProvider (future) — calls Anthropic API
 */
export interface SymptomAIProvider {
  /** Human-readable provider name for logging. */
  readonly name: string;

  /**
   * Analyze patient symptoms and return structured raw JSON.
   *
   * The output must match the shape expected by RawAnalysisSchema.
   * The caller (route) validates the output — the provider does not.
   *
   * @param input - Structured symptom data + language preference
   * @returns Raw JSON analysis or error
   */
  analyze(input: ProviderInput): Promise<ProviderResult>;
}
