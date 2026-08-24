/**
 * GET /api/calendar/callback
 *
 * Google OAuth2 callback endpoint.
 * Receives the authorization code after user approves consent,
 * exchanges it for access/refresh tokens, and stores them.
 *
 * Flow:
 *   1. Google redirects here with ?code=...&state=<profileId>
 *   2. Exchange code for tokens
 *   3. Store tokens in oauth_tokens table
 *   4. Redirect user back to dashboard with success/error
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // profileId
  const error = searchParams.get('error');

  // --- Handle OAuth denial ---
  if (error) {
    console.warn(`[CalendarService] ⚠️  OAuth denied: error=${error}`);
    return NextResponse.redirect(
      new URL(`/patient?calendar=denied&error=${error}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/patient?calendar=error&reason=missing_params', request.url)
    );
  }

  const profileId = state;

  try {
    const { getCalendarProvider } = await import('@/lib/calendar/calendar-service');
    const provider = await getCalendarProvider();

    if (provider.provider !== 'google') {
      return NextResponse.redirect(
        new URL('/patient?calendar=error&reason=not_google', request.url)
      );
    }

    const { GoogleCalendarProvider } = await import('@/lib/calendar/google-calendar-provider');
    if (!(provider instanceof GoogleCalendarProvider)) {
      return NextResponse.redirect(
        new URL('/patient?calendar=error&reason=wrong_provider', request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokens = await provider.exchangeCodeForTokens(code);

    // Store tokens securely in Supabase
    const { SupabaseTokenStore } = await import('@/lib/calendar/google-calendar-provider');
    const tokenStore = new SupabaseTokenStore();
    await tokenStore.setTokens(profileId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    console.log(
      `[CalendarService] ✅ OAuth complete: profile=${profileId} provider=google`
    );

    return NextResponse.redirect(
      new URL('/patient?calendar=connected', request.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CalendarService] ❌ OAuth callback failed: ${msg}`);

    return NextResponse.redirect(
      new URL(`/patient?calendar=error&reason=token_exchange_failed`, request.url)
    );
  }
}
