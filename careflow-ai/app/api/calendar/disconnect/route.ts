/**
 * POST /api/calendar/disconnect
 *
 * Disconnects Google Calendar by deleting stored tokens.
 * Calendar sync records are preserved for history.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'MISSING_PROFILE_ID', message: 'profileId is required.' },
        { status: 400 }
      );
    }

    const { SupabaseTokenStore } = await import('@/lib/calendar/google-calendar-provider');
    const tokenStore = new SupabaseTokenStore();
    await tokenStore.deleteTokens(profileId);

    console.log(`[CalendarService] 🔌 Calendar disconnected for profile=${profileId}`);

    return NextResponse.json({ ok: true, message: 'Calendar disconnected.' });
  } catch (err) {
    console.error('[CalendarService] ❌ /api/calendar/disconnect error:', err);
    return NextResponse.json(
      { error: 'DISCONNECT_FAILED', message: 'Failed to disconnect calendar.' },
      { status: 500 }
    );
  }
}
