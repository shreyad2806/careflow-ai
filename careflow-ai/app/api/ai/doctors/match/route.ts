/**
 * POST /api/ai/doctors/match
 *
 * Matches the latest AI-suggested specialty to real doctors in Supabase.
 * Returns ranked results with earliest available slots.
 *
 * Algorithm:
 *   1. Fetch latest ai_analyses for patient
 *   2. Extract suggested_speciality
 *   3. Query active doctors + profiles
 *   4. Rank by: exact match > contains > all doctors
 *   5. For each doctor, find next available date (via availability table)
 *   6. Generate real slots for the top match using existing slot service
 *
 * Does NOT modify booking concurrency logic.
 * Uses existing generateAvailableSlots from availability service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateAvailableSlots } from '@/lib/services/availability';
import type { SlotGenerationResult } from '@/lib/services/availability';

// ============================================================
// Dev logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [/api/ai/doctors/match]';
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
    patientId: z.string().uuid('patientId must be a valid UUID'),
    maxDays: z.number().int().min(1).max(30).default(7),
  })
  .strict();

// ============================================================
// Response types
// ============================================================

interface MatchedDoctor {
  doctorId: string;
  name: string;
  specialty: string;
  experience: number;
  consultationFee: number;
  languages: string[];
  imageUrl: string;
  /** 0 = exact match, 1 = contains keyword, 2 = fallback */
  matchRank: number;
  matchLabel: 'exact' | 'contains' | 'fallback';
  /** Next available date in YYYY-MM-DD format, or null */
  nextAvailableDate: string | null;
  /** Available slots for the next available date */
  nextAvailableSlots: Array<{ startTime: string; endTime: string }>;
}

interface SuccessResponse {
  ok: true;
  suggestedSpecialty: string;
  analysisId: string | null;
  matches: MatchedDoctor[];
}

interface ErrorResponse {
  ok: false;
  error: string;
  message: string;
}

// ============================================================
// Specialty matching
// ============================================================

function computeMatchRank(
  doctorSpecialty: string,
  suggestedSpecialty: string
): { rank: number; label: 'exact' | 'contains' | 'fallback' } {
  const doc = doctorSpecialty.toLowerCase().trim();
  const sug = suggestedSpecialty.toLowerCase().trim();

  if (doc === sug) {
    return { rank: 0, label: 'exact' };
  }
  if (doc.includes(sug) || sug.includes(doc)) {
    return { rank: 1, label: 'contains' };
  }
  return { rank: 2, label: 'fallback' };
}

// ============================================================
// Availability lookup
// ============================================================

/**
 * Find the next N available dates for a doctor by querying their
 * availability schedule (day_of_week). No slot generation — just dates.
 */
async function findAvailableDates(
  doctorId: string,
  maxDays: number
): Promise<string[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('doctor_availability')
    .select('day_of_week')
    .eq('doctor_id', doctorId)
    .eq('is_active', true);

  if (error || !data || data.length === 0) return [];

  // Unique days of week (0=Sun, 1=Mon, ..., 6=Sat)
  const availableDays = [...new Set(data.map((r) => r.day_of_week as number))];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: string[] = [];

  for (let i = 0; i <= maxDays && dates.length < maxDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (availableDays.includes(d.getDay())) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  return dates;
}

// ============================================================
// POST handler
// ============================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();

  // --- Step 1: Parse and validate request ---
  let body: z.infer<typeof RequestBodySchema>;
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

  log('info', `Request: patientId=${body.patientId} maxDays=${body.maxDays}`);

  // --- Step 2: Fetch latest AI analysis ---
  const supabase = createSupabaseServerClient();

  const { data: analysis, error: analysisError } = await supabase
    .from('ai_analyses')
    .select('id, suggested_speciality, urgency')
    .eq('patient_id', body.patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysisError) {
    log('error', `Analysis query failed: ${analysisError.message}`);
    return NextResponse.json(
      {
        ok: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch analysis data.',
      },
      { status: 500 }
    );
  }

  if (!analysis) {
    log('warn', `No analysis found for patient ${body.patientId}`);
    return NextResponse.json(
      {
        ok: false,
        error: 'NO_ANALYSIS',
        message: 'No symptom analysis found. Please complete a symptom check first.',
      },
      { status: 404 }
    );
  }

  const suggestedSpecialty = analysis.suggested_speciality || '';
  log('info', `Latest analysis: specialty="${suggestedSpecialty}" urgency=${analysis.urgency}`);

  // --- Step 3: Fetch active doctors with profiles ---
  const { data: doctors, error: doctorsError } = await supabase
    .from('doctors')
    .select(`
      id,
      speciality,
      experience_years,
      consultation_fee,
      languages,
      profile_id,
      profiles ( full_name, avatar_url )
    `)
    .eq('is_active', true)
    .order('experience_years', { ascending: false });

  if (doctorsError) {
    log('error', `Doctors query failed: ${doctorsError.message}`);
    return NextResponse.json(
      {
        ok: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch doctors.',
      },
      { status: 500 }
    );
  }

  if (!doctors || doctors.length === 0) {
    log('warn', 'No active doctors found');
    return NextResponse.json({
      ok: true,
      suggestedSpecialty,
      analysisId: analysis.id,
      matches: [],
    });
  }

  // --- Step 4: Rank and match ---
  type DoctorRow = (typeof doctors)[number];
  // deno-lint-ignore no-explicit-any
  const profileMap = new Map<string, any>();
  for (const doc of doctors) {
    // deno-lint-ignore no-explicit-any
    const profiles = doc.profiles as any;
    if (profiles) {
      profileMap.set(doc.id, profiles);
    }
  }

  // deno-lint-ignore no-explicit-any
  const ranked: Array<DoctorRow & { matchRank: number; matchLabel: 'exact' | 'contains' | 'fallback' }> =
    doctors.map((doc) => {
      const { rank, label } = computeMatchRank(doc.speciality, suggestedSpecialty);
      return { ...doc, matchRank: rank, matchLabel: label };
    });

  // Sort: exact first, then contains, then fallback; within same rank, by experience desc
  ranked.sort((a, b) => {
    if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
    return (b.experience_years || 0) - (a.experience_years || 0);
  });

  // --- Step 5: Find availability for top matches ---
  const MAX_DOCTORS_TO_CHECK = 6;
  const matches: MatchedDoctor[] = [];

  for (const doc of ranked.slice(0, MAX_DOCTORS_TO_CHECK)) {
    const profile = profileMap.get(doc.id);
    const availableDates = await findAvailableDates(doc.id, body.maxDays);

    let nextDate: string | null = null;
    let nextSlots: Array<{ startTime: string; endTime: string }> = [];

    if (availableDates.length > 0) {
      // Try the first available date — generate real slots
      const slotResult: SlotGenerationResult = await generateAvailableSlots(
        doc.id,
        availableDates[0]
      );

      if (slotResult.ok && slotResult.slots.length > 0) {
        nextDate = availableDates[0];
        nextSlots = slotResult.slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
        }));
      } else {
        // First date has no slots — try next dates
        for (let i = 1; i < availableDates.length; i++) {
          const nextResult = await generateAvailableSlots(doc.id, availableDates[i]);
          if (nextResult.ok && nextResult.slots.length > 0) {
            nextDate = availableDates[i];
            nextSlots = nextResult.slots.map((s) => ({
              startTime: s.startTime,
              endTime: s.endTime,
            }));
            break;
          }
        }
      }
    }

    matches.push({
      doctorId: doc.id,
      name: profile?.full_name || 'Unknown Doctor',
      specialty: doc.speciality,
      experience: doc.experience_years || 0,
      consultationFee: Number(doc.consultation_fee) || 0,
      languages: doc.languages || [],
      imageUrl: profile?.avatar_url || '',
      matchRank: doc.matchRank,
      matchLabel: doc.matchLabel,
      nextAvailableDate: nextDate,
      nextAvailableSlots: nextSlots,
    });
  }

  // --- Step 6: Return ---
  const elapsed = Date.now() - startTime;
  log(
    'info',
    `Match complete in ${elapsed}ms: ${matches.length} doctors, ` +
      `${matches.filter((m) => m.matchLabel === 'exact').length} exact, ` +
      `${matches.filter((m) => m.nextAvailableDate).length} with slots`
  );

  return NextResponse.json({
    ok: true,
    suggestedSpecialty,
    analysisId: analysis.id,
    matches,
  });
}

// ============================================================
// Method not allowed
// ============================================================

export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Use POST with a JSON body to match doctors.',
    },
    { status: 405 }
  );
}
