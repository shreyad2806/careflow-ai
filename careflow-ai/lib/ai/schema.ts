/**
 * Zod validation schemas for AI Symptom Analysis.
 *
 * Two schemas:
 *   1. RawAnalysisSchema  — validates the raw JSON from the LLM (flexible)
 *   2. AnalysisResultSchema — validates the canonical output (strict)
 *
 * The raw schema is intentionally permissive:
 *   - Accepts both uppercase and lowercase urgency
 *   - Accepts string arrays or single strings
 *   - Coerces shapes that are "close enough"
 *
 * The result schema is strict:
 *   - All fields required and non-empty
 *   - Urgency is uppercase only
 *   - Questions count is 1–5
 */

import { z } from 'zod';

// ============================================================
// Urgency — accept both cases from LLM, normalize to uppercase
// ============================================================

const UrgencySchema = z
  .string()
  .transform((val) => val.toUpperCase().trim())
  .pipe(z.enum(['LOW', 'MEDIUM', 'HIGH']));

// ============================================================
// Raw schema — validates LLM JSON output (permissive)
// ============================================================

/**
 * Schema for raw LLM output.
 *
 * LLMs sometimes return:
 *   - "migraine, tension headache" (single string) instead of an array
 *   - "medium" instead of "MEDIUM"
 *   - Extra fields we don't use
 *
 * This schema normalizes these edge cases.
 */
export const RawAnalysisSchema = z
  .object({
    /** Required. Patient's primary complaint. */
    chief_complaint: z.string().min(1, 'chief_complaint must not be empty'),

    /**
     * Required. Identified symptoms.
     * Accepts a string array OR a single comma-separated string.
     */
    symptoms: z.union([
      z.array(z.string().min(1)),
      z.string().transform((s) =>
        s
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      ),
    ]),

    /** Required. Urgency level (any casing). */
    urgency: UrgencySchema,

    /** Required. Recommended specialty. */
    suggested_specialty: z.string().min(1, 'suggested_specialty must not be empty'),

    /** Required. Clinician-facing summary. */
    patient_summary: z.string().min(1, 'patient_summary must not be empty'),

    /**
     * Required. Follow-up questions for the doctor.
     * Accepts a string array OR a single comma-separated string.
     * Must contain 1–5 questions after normalization.
     */
    suggested_questions: z
      .union([
        z.array(z.string().min(1)),
        z.string().transform((s) =>
          s
            .split(/[;\n]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        ),
      ])
      .pipe(
        z
          .array(z.string().min(1))
          .min(1, 'suggested_questions must contain at least 1 question')
          .max(5, 'suggested_questions must contain at most 5 questions')
      ),
  })
  .strict();

// ============================================================
// Result schema — strict validated output
// ============================================================

/**
 * Schema for the canonical analysis result.
 * All fields required, non-empty, properly typed.
 */
export const AnalysisResultSchema = z.object({
  chiefComplaint: z.string().min(1),
  symptoms: z.array(z.string().min(1)).min(1),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  suggestedSpecialty: z.string().min(1),
  patientSummary: z.string().min(1),
  suggestedQuestions: z
    .array(z.string().min(1))
    .min(1, 'Must contain at least 1 question')
    .max(5, 'Must contain at most 5 questions'),
});

// ============================================================
// Prompt construction
// ============================================================

/** System prompt that instructs the LLM to return structured JSON. */
const SYSTEM_PROMPT = `You are a medical symptom analysis assistant for CareFlow AI.

Given a patient's symptom description, analyze the symptoms and return a JSON object with the following fields:

{
  "chief_complaint": "<one-phrase summary of the primary complaint>",
  "symptoms": ["<identified symptom 1>", "<identified symptom 2>", ...],
  "urgency": "<LOW | MEDIUM | HIGH>",
  "suggested_specialty": "<most appropriate medical specialty>",
  "patient_summary": "<2-3 sentence clinician-facing summary>",
  "suggested_questions": ["<question 1>", "<question 2>", ...]
}

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- urgency: LOW for routine/non-urgent, MEDIUM for conditions needing attention within days, HIGH for conditions needing same-day or next-day care.
- suggested_questions: 1 to 5 follow-up questions a doctor should ask.
- symptoms: list each distinct symptom on its own line in the array.
- Do NOT include a diagnosis. Only suggest a specialty and ask follow-up questions.
- Include a medical disclaimer implicitly through careful, cautious language.`;

/**
 * Build the user message for the LLM from structured symptom input.
 */
export function buildAnalysisPrompt(input: {
  description: string;
  category?: string;
  duration?: string;
  severity?: string;
  additionalSymptoms?: string[];
  language?: string;
}): string {
  const parts: string[] = [];

  parts.push(`Patient symptom description: "${input.description}"`);

  if (input.category) {
    parts.push(`Symptom category: ${input.category}`);
  }
  if (input.duration) {
    parts.push(`Duration: ${input.duration}`);
  }
  if (input.severity) {
    parts.push(`Severity: ${input.severity}`);
  }
  if (input.additionalSymptoms && input.additionalSymptoms.length > 0) {
    parts.push(`Additional symptoms: ${input.additionalSymptoms.join(', ')}`);
  }
  if (input.language && input.language !== 'en') {
    parts.push(`Patient's preferred language: ${input.language}. Respond in English for medical accuracy, but note the language preference.`);
  }

  return parts.join('\n');
}

/** Export the system prompt for the service layer. */
export { SYSTEM_PROMPT };
