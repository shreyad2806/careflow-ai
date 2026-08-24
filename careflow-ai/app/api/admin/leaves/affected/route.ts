/**
 * GET /api/admin/leaves/affected?doctorId=xxx&startDate=xxx&endDate=xxx
 *
 * Returns the list of PENDING/CONFIRMED appointments that would be
 * affected by a proposed leave. Used by the admin UI to show a
 * conflict preview before creating the leave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAffectedAppointments } from '@/lib/services/leave-conflict';

// ============================================================
// Logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/admin/leaves/affected]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}

// ============================================================
// GET handler
// ============================================================

export async function GET(
  request: NextRequest
): Promise<
  NextResponse<
    | { ok: true; appointments: Array<{ appointmentId: string; patientId: string; date: string; time: string; status: string }> }
    | { ok: false; error: string; message: string }
  >
> {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!doctorId || !startDate || !endDate) {
    log('warn', 'Missing required query params');
    return NextResponse.json(
      { ok: false, error: 'VALIDATION_ERROR', message: 'doctorId, startDate, and endDate are required.' },
      { status: 400 }
    );
  }

  // Validate date formats
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    log('warn', `Invalid date format: startDate=${startDate} endDate=${endDate}`);
    return NextResponse.json(
      { ok: false, error: 'VALIDATION_ERROR', message: 'Dates must be in YYYY-MM-DD format.' },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { ok: false, error: 'VALIDATION_ERROR', message: 'startDate must be before or equal to endDate.' },
      { status: 400 }
    );
  }

  log('info', `Checking affected: doctorId=${doctorId} range=${startDate}–${endDate}`);

  const affected = await getAffectedAppointments(doctorId, startDate, endDate);

  log('info', `Found ${affected.length} affected appointments`);

  return NextResponse.json(
    {
      ok: true,
      appointments: affected.map(a => ({
        appointmentId: a.appointmentId,
        patientId: a.patientId,
        date: a.appointmentDate,
        time: a.startTime,
        status: a.status,
      })),
    },
    { status: 200 }
  );
}
