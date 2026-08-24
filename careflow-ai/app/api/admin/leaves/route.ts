/**
 * POST /api/admin/leaves
 *
 * Creates a doctor leave with full conflict handling:
 *   - Validates inputs
 *   - Checks for overlapping approved leaves
 *   - Finds affected appointments
 *   - Creates notifications for affected patients
 *   - Releases overlapping slot holds
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDoctorLeave } from '@/lib/services/leave-conflict';
import { getDoctorLeaves } from '@/lib/services/leaves';

// ============================================================
// Logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/admin/leaves]';
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
    doctorId: z.string().uuid('doctorId must be a valid UUID'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
    reason: z.string().max(500).optional(),
    status: z.enum(['pending', 'approved']).default('approved'),
  })
  .strict();

// ============================================================
// Response types
// ============================================================

interface SuccessResponse {
  ok: true;
  leaveId: string;
  affectedAppointments: number;
  notificationsCreated: number;
  holdsReleased: number;
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

  log('info', `Creating leave: doctorId=${body.doctorId} range=${body.startDate}–${body.endDate} status=${body.status}`);

  const result = await createDoctorLeave(body);

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400,
      DOCTOR_NOT_FOUND: 404,
      OVERLAPPING_LEAVE: 409,
      DUPLICATE_LEAVE: 409,
    };
    const status = statusMap[result.error] || 500;

    log('warn', `Leave creation failed: ${result.error} — ${result.message}`);
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status });
  }

  log(
    'info',
    `Leave created: id=${result.leaveId} affected=${result.affectedAppointments} ` +
      `notifications=${result.notificationsCreated} holdsReleased=${result.holdsReleased}`
  );

  return NextResponse.json(
    {
      ok: true,
      leaveId: result.leaveId,
      affectedAppointments: result.affectedAppointments,
      notificationsCreated: result.notificationsCreated,
      holdsReleased: result.holdsReleased,
    },
    { status: 201 }
  );
}

// ============================================================
// GET handler — list all leaves
// ============================================================

export async function GET(): Promise<NextResponse> {
  const leaves = await getDoctorLeaves();
  return NextResponse.json({ ok: true, leaves }, { status: 200 });
}
