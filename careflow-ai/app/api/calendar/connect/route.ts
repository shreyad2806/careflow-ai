/**
 * GET /api/calendar/connect
 *
 * Initiates the Google OAuth2 flow.
 * Returns a redirect URL that the frontend can navigate to,
 * or redirects directly to Google's consent screen.
 *
 * The profile_id is passed as a query parameter to the frontend,
 * which includes it as the OAuth state parameter so we can
 * associate the returned tokens with the correct user.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getCalendarProvider } = await import('@/lib/calendar/calendar-service');
    const provider = await getCalendarProvider();

    // Check if Google is configured
    if (provider.provider !== 'google') {
      return NextResponse.json(
        {
          error: 'GOOGLE_NOT_CONFIGURED',
          message: 'Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your environment.',
          mockMode: true,
        },
        { status: 200 }
      );
    }

    // Get profile_id from query params
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profile_id');

    if (!profileId) {
      return NextResponse.json(
        { error: 'MISSING_PROFILE_ID', message: 'profile_id query parameter is required.' },
        { status: 400 }
      );
    }

    // Generate the Google OAuth consent URL
    // State parameter carries the profile_id so we can associate tokens on callback
    const { GoogleCalendarProvider } = await import('@/lib/calendar/google-calendar-provider');
    if (!(provider instanceof GoogleCalendarProvider)) {
      return NextResponse.json(
        { error: 'WRONG_PROVIDER', message: 'Calendar provider is not Google.' },
        { status: 500 }
      );
    }

    const authUrl = provider.getAuthUrl(profileId);

    console.log(`[CalendarService] 🔗 OAuth initiated for profile=${profileId}`);

    return NextResponse.json({ url: authUrl });
  } catch (err) {
    console.error('[CalendarService] ❌ /api/calendar/connect error:', err);
    return NextResponse.json(
      { error: 'CONNECT_FAILED', message: 'Failed to initiate calendar connection.' },
      { status: 500 }
    );
  }
}
