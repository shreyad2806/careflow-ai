/**
 * POST /api/ai/consultation/save
 *
 * Saves doctor-entered consultation notes and AI-generated
 * post-visit summary to the consultation_notes table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveConsultationNotes } from '@/lib/services/consultation-notes';

// ============================================================
// Logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/ai/consultation/save]';
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
    appointmentId: z.string().uuid(),
    doctorId: z.string().uuid(),
    patientId: z.string().uuid(),
    clinicalNotes: z.string().max(5000).optional().default(''),
    diagnosis: z.string().max(2000).optional().default(''),
    prescription: z.string().max(2000).optional().default(''),
    aiSummary: z
      .object({
        patientSummary: z.string(),
        keyFindings: z.array(z.string()),
        medications: z.array(
          z.object({
            name: z.string(),
            dosage: z.string(),
            frequency: z.string(),
            instructions: z.string(),
          })
        ),
        followUpSteps: z.array(z.string()),
        warningSigns: z.array(z.string()),
      })
      .nullable()
      .optional()
      .default(null),
    language: z.enum(['en', 'hi']).default('en'),
  })
  .strict();

// ============================================================
// POST handler
// ============================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ ok: true; noteId: string } | { ok: false; error: string; message: string }>> {
  let body: z.infer<typeof RequestBodySchema>;

  try {
    const raw = await request.json();
    const parsed = RequestBodySchema.safeParse(raw);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join('.') || 'body';
      const message = firstIssue?.message || 'Invalid request body';
      log('warn', `Validation failed: ${field} — ${message}`);
      return NextResponse.json({ ok: false, error: 'VALIDATION_ERROR', message }, { status: 400 });
    }

    body = parsed.data;
  } catch {
    log('warn', 'Request body is not valid JSON');
    return NextResponse.json({ ok: false, error: 'INVALID_JSON', message: 'Invalid JSON.' }, { status: 400 });
  }

  log('info', `Saving: appointmentId=${body.appointmentId} hasAiSummary=${!!body.aiSummary}`);

  // Map camelCase AI summary to snake_case PostVisitSummary for storage
  const aiSummaryForStorage = body.aiSummary
    ? {
        patient_summary: body.aiSummary.patientSummary,
        key_findings: body.aiSummary.keyFindings,
        medications: body.aiSummary.medications,
        follow_up_steps: body.aiSummary.followUpSteps,
        warning_signs: body.aiSummary.warningSigns,
      }
    : null;

  const result = await saveConsultationNotes({
    appointmentId: body.appointmentId,
    doctorId: body.doctorId,
    patientId: body.patientId,
    clinicalNotes: body.clinicalNotes,
    diagnosis: body.diagnosis,
    prescription: body.prescription,
    aiSummary: aiSummaryForStorage as Parameters<typeof saveConsultationNotes>[0]['aiSummary'],
    language: body.language,
  });

  if (!result.ok) {
    log('error', `Save failed: ${result.error} — ${result.message}`);
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status: 500 });
  }

  log('info', `Saved: noteId=${result.noteId}`);
  return NextResponse.json({ ok: true, noteId: result.noteId }, { status: 200 });
}
