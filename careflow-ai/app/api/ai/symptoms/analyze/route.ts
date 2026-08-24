/**
 * POST /api/ai/symptoms/analyze
 *
 * Accepts structured symptom input, runs it through an AI provider,
 * validates the output, and returns structured analysis JSON.
 *
 * Flow:
 *   1. Validate request body (Zod)
 *   2. Call provider (mock or OpenAI)
 *   3. Validate provider output (RawAnalysisSchema)
 *   4. Persist validated result to ai_analyses
 *   5. Return validated JSON
 *
 * Persistence failure does NOT block the response —
 * the analysis is still returned to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProvider } from '@/lib/ai/provider-factory';
import { validateAnalysis } from '@/lib/ai/validate';
import { saveAnalysis } from '@/lib/services/ai-analysis';
import type { AnalysisLanguage } from '@/lib/ai/types';

// ============================================================
// Dev logger — matches project convention from lib/services/logger.ts
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/ai/symptoms/analyze]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// Request validation schema
// ============================================================

const RequestBodySchema = z
  .object({
    /** Required. Free-text symptom description from the patient. */
    description: z
      .string()
      .min(1, 'description is required')
      .max(2000, 'description must be at most 2000 characters'),

    /** Optional. Symptom category from predefined list. */
    category: z.string().max(100).optional(),

    /** Optional. Duration of symptoms. */
    duration: z.string().max(100).optional(),

    /** Optional. Severity level. */
    severity: z.string().max(50).optional(),

    /** Optional. Additional symptoms the patient selected. */
    additionalSymptoms: z
      .array(z.string().max(100))
      .max(20, 'At most 20 additional symptoms allowed')
      .optional(),

    /** Optional. Patient's preferred language. Defaults to 'en'. */
    language: z.enum(['en', 'hi']).default('en'),

    /** Required for persistence. Patient UUID from the patients table. */
    patientId: z.string().uuid('patientId must be a valid UUID'),
  })
  .strict();

type RequestBody = z.infer<typeof RequestBodySchema>;

// ============================================================
// Response types
// ============================================================

interface SuccessResponse {
  ok: true;
  data: {
    chiefComplaint: string;
    symptoms: string[];
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedSpecialty: string;
    patientSummary: string;
    suggestedQuestions: string[];
  };
  provider: string;
  /** ID of the persisted analysis row. Null if persistence failed. */
  analysisId: string | null;
}

interface ErrorResponse {
  ok: false;
  error: string;
  message: string;
}

// ============================================================
// POST handler
// ============================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();

  // --- Step 1: Parse and validate request body ---
  let body: RequestBody;
  try {
    const raw = await request.json();
    const parsed = RequestBodySchema.safeParse(raw);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join('.') || 'body';
      const message = firstIssue?.message || 'Invalid request body';

      log('warn', `Request validation failed: ${field} — ${message}`);

      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          message: `Invalid input at "${field}": ${message}`,
        },
        { status: 400 }
      );
    }

    body = parsed.data;
  } catch {
    log('warn', 'Request body is not valid JSON');

    return NextResponse.json(
      {
        ok: false,
        error: 'INVALID_JSON',
        message: 'Request body must be valid JSON.',
      },
      { status: 400 }
    );
  }

  // --- Step 2: Log incoming request ---
  log(
    'info',
    `Request: description="${body.description.slice(0, 80)}${body.description.length > 80 ? '...' : ''}" ` +
      `category=${body.category || '(none)'} ` +
      `language=${body.language} ` +
      `additionalSymptoms=${body.additionalSymptoms?.length || 0}`
  );

  // --- Step 3: Call provider (selected by AI_PROVIDER env var) ---
  const provider = getProvider();

  let providerResult;
  try {
    providerResult = await provider.analyze({
      symptoms: {
        description: body.description,
        category: body.category,
        duration: body.duration,
        severity: body.severity,
        additionalSymptoms: body.additionalSymptoms,
      },
      language: body.language as AnalysisLanguage,
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    log('error', `Provider threw after ${elapsed}ms: ${err}`);

    return NextResponse.json(
      {
        ok: false,
        error: 'PROVIDER_ERROR',
        message: 'The analysis service encountered an unexpected error.',
      },
      { status: 500 }
    );
  }

  if (!providerResult.ok) {
    const elapsed = Date.now() - startTime;
    log('warn', `Provider failed after ${elapsed}ms: ${providerResult.error} — ${providerResult.message}`);

    return NextResponse.json(
      {
        ok: false,
        error: 'PROVIDER_FAILED',
        message: providerResult.message,
      },
      { status: 502 }
    );
  }

  // --- Step 4: Validate provider output ---
  const validation = validateAnalysis(providerResult.data);

  if (!validation.ok) {
    const elapsed = Date.now() - startTime;
    log(
      'warn',
      `Provider output invalid after ${elapsed}ms: ${validation.error} — ${validation.message}`
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'PROVIDER_OUTPUT_INVALID',
        message: 'The analysis service returned invalid data. Please try again.',
      },
      { status: 502 }
    );
  }

  // --- Step 5: Persist to ai_analyses ---
  let analysisId: string | null = null;
  const persistResult = await saveAnalysis(
    validation.data,
    body.patientId,
    body.language as AnalysisLanguage,
    providerResult.data
  );

  if (persistResult.ok) {
    analysisId = persistResult.analysisId;
    log('info', `Persisted analysis: id=${analysisId}`);
  } else {
    // Persistence failed — log but do NOT block the response.
    // The analysis is still valid and useful to the client.
    log('warn', `Persistence failed: ${persistResult.error} — ${persistResult.message}`);
  }

  // --- Step 6: Return validated result ---
  const elapsed = Date.now() - startTime;
  log(
    'info',
    `Analysis complete in ${elapsed}ms: urgency=${validation.data.urgency} specialty=${validation.data.suggestedSpecialty} persisted=${analysisId ? 'yes' : 'no'}`
  );

  return NextResponse.json(
    {
      ok: true,
      data: validation.data,
      provider: provider.name,
      analysisId,
    },
    { status: 200 }
  );
}

// ============================================================
// Method not allowed
// ============================================================

export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Use POST with a JSON body to analyze symptoms.',
    },
    { status: 405 }
  );
}
