/**
 * Zod schema for the post-visit AI summary.
 *
 * This defines the structured output Gemini generates from doctor notes.
 * The output is patient-friendly and stored in consultation_notes.ai_summary.
 */

import { z } from 'zod';

// ============================================================
// Medication schema
// ============================================================

export const MedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  instructions: z.string().min(1, 'Instructions are required'),
});

export type Medication = z.infer<typeof MedicationSchema>;

// ============================================================
// Full post-visit AI summary schema
// ============================================================

export const PostVisitSummarySchema = z.object({
  patient_summary: z
    .string()
    .min(10, 'Patient summary must be at least 10 characters')
    .max(2000, 'Patient summary must be at most 2000 characters'),
  key_findings: z
    .array(z.string().min(1))
    .min(1, 'At least one key finding is required')
    .max(10, 'At most 10 key findings'),
  medications: z
    .array(MedicationSchema)
    .max(10, 'At most 10 medications'),
  follow_up_steps: z
    .array(z.string().min(1))
    .min(1, 'At least one follow-up step is required')
    .max(10, 'At most 10 follow-up steps'),
  warning_signs: z
    .array(z.string().min(1))
    .min(1, 'At least one warning sign is required')
    .max(10, 'At most 10 warning signs'),
});

export type PostVisitSummary = z.infer<typeof PostVisitSummarySchema>;

// ============================================================
// Validation result types
// ============================================================

export interface ValidationSuccess {
  ok: true;
  data: PostVisitSummary;
}

export interface ValidationError {
  ok: false;
  error: string;
  message: string;
  raw?: unknown;
}

export type ValidationResult = ValidationSuccess | ValidationError;

// ============================================================
// Validate a raw AI output object
// ============================================================

export function validatePostVisitSummary(raw: unknown): ValidationResult {
  const result = PostVisitSummarySchema.safeParse(raw);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const firstIssue = result.error.issues[0];
  const field = firstIssue?.path?.join('.') || 'root';
  const message = firstIssue?.message || 'Validation failed';

  return {
    ok: false,
    error: 'POST_VISIT_VALIDATION_FAILED',
    message: `Invalid AI output at "${field}": ${message}`,
    raw,
  };
}
