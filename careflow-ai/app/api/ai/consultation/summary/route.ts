/**
 * POST /api/ai/consultation/summary
 *
 * Accepts doctor-entered consultation notes and generates a
 * patient-friendly post-visit summary using Gemini.
 *
 * Flow:
 *   1. Validate request body (Zod)
 *   2. Call consultation AI provider (Gemini)
 *   3. Validate AI output (PostVisitSummarySchema)
 *   4. Return validated JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePostVisitSummary } from '@/lib/ai/consultation-provider';

// ============================================================
// Logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/ai/consultation/summary]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// Request schema
// ============================================================

const RequestBodySchema = z
  .object({
    clinicalNotes: z
      .string()
      .min(10, 'Clinical notes must be at least 10 characters')
      .max(5000, 'Clinical notes must be at most 5000 characters'),
    diagnosis: z.string().max(2000).optional().default(''),
    prescription: z.string().max(2000).optional().default(''),
    language: z.enum(['en', 'hi']).default('en'),
    appointmentId: z.string().uuid('appointmentId must be a valid UUID'),
    doctorId: z.string().uuid('doctorId must be a valid UUID'),
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
    patientSummary: string;
    keyFindings: string[];
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      instructions: string;
    }>;
    followUpSteps: string[];
    warningSigns: string[];
  };
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

  // --- Step 1: Parse and validate request ---
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
        { ok: false, error: 'VALIDATION_ERROR', message: `Invalid input at "${field}": ${message}` },
        { status: 400 }
      );
    }

    body = parsed.data;
  } catch {
    log('warn', 'Request body is not valid JSON');
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  // --- Step 2: Log request ---
  log(
    'info',
    `Request: appointmentId=${body.appointmentId} doctorId=${body.doctorId} ` +
      `language=${body.language} notesLength=${body.clinicalNotes.length}`
  );

  // --- Step 3: Generate AI summary ---
  const result = await generatePostVisitSummary({
    clinicalNotes: body.clinicalNotes,
    diagnosis: body.diagnosis,
    prescription: body.prescription,
    language: body.language,
  });

  if (!result.ok) {
    const elapsed = Date.now() - startTime;
    log('warn', `AI generation failed after ${elapsed}ms: ${result.error} — ${result.message}`);

    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status: 502 }
    );
  }

  // --- Step 4: Return validated result ---
  const elapsed = Date.now() - startTime;
  log(
    'info',
    `Summary generated in ${elapsed}ms: ` +
      `findings=${result.data.key_findings.length} ` +
      `medications=${result.data.medications.length} ` +
      `followUp=${result.data.follow_up_steps.length}`
  );

  return NextResponse.json(
    {
      ok: true,
      data: {
        patientSummary: result.data.patient_summary,
        keyFindings: result.data.key_findings,
        medications: result.data.medications,
        followUpSteps: result.data.follow_up_steps,
        warningSigns: result.data.warning_signs,
      },
    },
    { status: 200 }
  );
}

// ============================================================
// GET not allowed
// ============================================================

export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'Use POST with a JSON body.' },
    { status: 405 }
  );
}
