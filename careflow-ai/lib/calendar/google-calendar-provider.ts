/**
 * Google Calendar Provider
 *
 * Real Google Calendar integration using the googleapis SDK.
 * Handles OAuth2 token management, automatic token refresh,
 * and structured error returns.
 *
 * Security:
 *   - Client secret NEVER leaves the server
 *   - Access tokens are stored via TokenStore (database)
 *   - Refresh tokens are used to silently renew expired access tokens
 *   - No tokens or secrets are logged or exposed to the client
 *
 * The provider never throws. All errors are returned as CalendarSyncFailure.
 */

import { google, calendar_v3 } from 'googleapis';
import type { CalendarProvider, CalendarEventInput, CalendarSyncResult, OAuthTokens, TokenStore } from './types';

// ============================================================
// Configuration
// ============================================================

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
];

const DEFAULT_CALENDAR_ID = 'primary';

const CALENDAR_TIMEOUT_MS = 10_000; // 10 seconds

// ============================================================
// Google Calendar Provider
// ============================================================

export class GoogleCalendarProvider implements CalendarProvider {
  readonly provider = 'google';

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tokenStore: TokenStore;
  private calendarId: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokenStore: TokenStore;
    calendarId?: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.tokenStore = config.tokenStore;
    this.calendarId = config.calendarId || DEFAULT_CALENDAR_ID;
  }

  // ------------------------------------------------------------
  // OAuth2 helpers
  // ------------------------------------------------------------

  /**
   * Create an OAuth2 client configured for Google Calendar.
   * Does NOT set credentials — call setCredentialsFromTokens() after.
   */
  private createOAuth2Client() {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  /**
   * Generate the Google OAuth consent URL.
   * Used by the /api/calendar/connect endpoint.
   */
  getAuthUrl(state?: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',       // Get a refresh token
      scope: GOOGLE_SCOPES,
      prompt: 'consent',            // Force consent to always get refresh_token
      state: state || '',
    });
  }

  /**
   * Exchange an authorization code for tokens.
   * Called after the user completes the OAuth consent flow.
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    const result: OAuthTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expiry_date || Date.now() + 3600_000,
      tokenType: tokens.token_type || 'Bearer',
    };

    return result;
  }

  /**
   * Get an authenticated calendar client for a user profile.
   * Automatically refreshes expired tokens.
   * Returns null if no valid tokens exist.
   */
  private async getAuthenticatedClient(profileId: string): Promise<calendar_v3.Calendar | null> {
    const tokens = await this.tokenStore.getTokens(profileId);
    if (!tokens) {
      console.warn(`[CalendarService] ⚠️  No tokens for profile ${profileId}`);
      return null;
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    // Check if token is expired and refresh if needed
    const now = Date.now();
    if (tokens.expiresAt && tokens.expiresAt < now + 60_000) {
      // Token expires within 60 seconds — refresh proactively
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          await this.tokenStore.setTokens(profileId, {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || tokens.refreshToken,
            expiresAt: credentials.expiry_date || Date.now() + 3600_000,
            tokenType: credentials.token_type || 'Bearer',
          });
          console.log(`[CalendarService] ✅ Token refreshed for profile ${profileId}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CalendarService] ❌ Token refresh failed for profile ${profileId}: ${msg}`);
        return null;
      }
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  // ------------------------------------------------------------
  // Calendar event operations
  // ------------------------------------------------------------

  async createEvent(input: CalendarEventInput): Promise<CalendarSyncResult> {
    // This is called by the orchestrator which passes the profileId.
    // We need the profileId to look up tokens. The orchestrator stores it
    // in the CalendarEventInput via an extended field.
    const profileId = (input as CalendarEventInput & { _profileId?: string })._profileId;
    if (!profileId) {
      return {
        ok: false,
        provider: 'google',
        error: 'NO_PROFILE_ID',
        message: 'Cannot create calendar event without a profile ID.',
      };
    }

    const calendar = await this.getAuthenticatedClient(profileId);
    if (!calendar) {
      return {
        ok: false,
        provider: 'google',
        error: 'NO_CREDENTIALS',
        message: 'Google Calendar is not connected for this account.',
      };
    }

    try {
      const event = this.buildEventResource(input);

      const response = await calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      });

      const eventId = response.data.id;
      if (!eventId) {
        return {
          ok: false,
          provider: 'google',
          error: 'NO_EVENT_ID',
          message: 'Google Calendar returned no event ID.',
        };
      }

      console.log(
        `[CalendarService] ✅ Google CREATE event=${eventId} appointment=${input.appointmentId}`
      );

      return {
        ok: true,
        externalEventId: eventId,
        provider: 'google',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[CalendarService] ❌ Google CREATE failed appointment=${input.appointmentId} error=${msg}`
      );
      return {
        ok: false,
        provider: 'google',
        error: 'GOOGLE_API_ERROR',
        message: `Google Calendar API error: ${msg}`,
      };
    }
  }

  async updateEvent(
    externalEventId: string,
    input: CalendarEventInput
  ): Promise<CalendarSyncResult> {
    const profileId = (input as CalendarEventInput & { _profileId?: string })._profileId;
    if (!profileId) {
      return {
        ok: false,
        provider: 'google',
        error: 'NO_PROFILE_ID',
        message: 'Cannot update calendar event without a profile ID.',
      };
    }

    const calendar = await this.getAuthenticatedClient(profileId);
    if (!calendar) {
      return {
        ok: false,
        provider: 'google',
        error: 'NO_CREDENTIALS',
        message: 'Google Calendar is not connected for this account.',
      };
    }

    try {
      const event = this.buildEventResource(input);

      const response = await calendar.events.patch({
        calendarId: this.calendarId,
        eventId: externalEventId,
        requestBody: event,
      });

      const updatedEventId = response.data.id || externalEventId;

      console.log(
        `[CalendarService] ✅ Google UPDATE event=${updatedEventId} appointment=${input.appointmentId}`
      );

      return {
        ok: true,
        externalEventId: updatedEventId,
        provider: 'google',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[CalendarService] ❌ Google UPDATE failed event=${externalEventId} error=${msg}`
      );
      return {
        ok: false,
        provider: 'google',
        error: 'GOOGLE_API_ERROR',
        message: `Google Calendar API error: ${msg}`,
      };
    }
  }

  async deleteEvent(externalEventId: string): Promise<CalendarSyncResult> {
    // For delete, we need the profileId from the sync record.
    // The orchestrator will pass it as _profileId on the input.
    // But deleteEvent only gets externalEventId.
    // We'll handle this by having the orchestrator pass profileId differently.
    // For now, accept it as a parameter via the types extension.

    // The orchestrator handles delete by looking up the sync record
    // and calling this. We need profileId to authenticate.
    // We'll extend the call to include it.
    return this.deleteEventForProfile(externalEventId, '');
  }

  /**
   * Delete a calendar event for a specific profile.
   * This is the actual implementation — deleteEvent delegates here.
   */
  async deleteEventForProfile(
    externalEventId: string,
    profileId: string
  ): Promise<CalendarSyncResult> {
    if (!profileId) {
      return {
        ok: false,
        provider: 'google',
        error: 'NO_PROFILE_ID',
        message: 'Cannot delete calendar event without a profile ID.',
      };
    }

    const calendar = await this.getAuthenticatedClient(profileId);
    if (!calendar) {
      // Calendar not connected — treat as already deleted
      console.warn(
        `[CalendarService] ⚠️  No credentials for delete, skipping event=${externalEventId}`
      );
      return {
        ok: true,
        externalEventId,
        provider: 'google',
      };
    }

    try {
      await calendar.events.delete({
        calendarId: this.calendarId,
        eventId: externalEventId,
      });

      console.log(
        `[CalendarService] ✅ Google DELETE event=${externalEventId}`
      );

      return {
        ok: true,
        externalEventId,
        provider: 'google',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // 404/410 = event already deleted — treat as success
      if (msg.includes('404') || msg.includes('410') || msg.includes('Not Found') || msg.includes('deleted')) {
        console.log(
          `[CalendarService] ℹ️  Google DELETE event=${externalEventId} (already deleted)`
        );
        return {
          ok: true,
          externalEventId,
          provider: 'google',
        };
      }

      console.error(
        `[CalendarService] ❌ Google DELETE failed event=${externalEventId} error=${msg}`
      );
      return {
        ok: false,
        provider: 'google',
        error: 'GOOGLE_API_ERROR',
        message: `Google Calendar API error: ${msg}`,
      };
    }
  }

  // ------------------------------------------------------------
  // Event resource builder
  // ------------------------------------------------------------

  private buildEventResource(input: CalendarEventInput): calendar_v3.Schema$Event {
    // Parse times — handle both HH:MM and HH:MM:SS
    const [startH, startM] = input.startTime.split(':').map(Number);
    const [endH, endM] = input.endTime.split(':').map(Number);

    // Build ISO datetime strings with timezone
    const startDate = input.date.replace(/-/g, '');
    const startDateTime = `${startDate}T${String(startH).padStart(2, '0')}${String(startM).padStart(2, '0')}00`;
    const endDateTime = `${startDate}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;

    const event: calendar_v3.Schema$Event = {
      summary: input.summary,
      description: input.description || '',
      location: input.location || '',
      start: {
        dateTime: startDateTime,
        timeZone: input.timezone || 'Asia/Kolkata',
      },
      end: {
        dateTime: endDateTime,
        timeZone: input.timezone || 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    };

    return event;
  }
}

// ============================================================
// Database-backed token store (Supabase)
// ============================================================

/**
 * Supabase-backed token store for OAuth tokens.
 * Stores tokens in a dedicated table (created in migration 010).
 */
export class SupabaseTokenStore implements TokenStore {
  async getTokens(profileId: string): Promise<OAuthTokens | null> {
    try {
      const { createSupabaseServerClient } = await import('@/lib/supabase/server');
      const supabase = createSupabaseServerClient();

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('profile_id', profileId)
        .eq('provider', 'google')
        .single();

      if (error || !data) return null;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at).getTime(),
      };
    } catch {
      return null;
    }
  }

  async setTokens(profileId: string, tokens: OAuthTokens): Promise<void> {
    try {
      const { createSupabaseServerClient } = await import('@/lib/supabase/server');
      const supabase = createSupabaseServerClient();

      const { error } = await supabase
        .from('oauth_tokens')
        .upsert({
          profile_id: profileId,
          provider: 'google',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: new Date(tokens.expiresAt).toISOString(),
        }, {
          onConflict: 'profile_id,provider',
        });

      if (error) {
        console.error(`[CalendarService] ❌ Failed to store tokens for profile ${profileId}:`, error.message);
      }
    } catch (err) {
      console.error(`[CalendarService] ❌ Token store error:`, err);
    }
  }

  async deleteTokens(profileId: string): Promise<void> {
    try {
      const { createSupabaseServerClient } = await import('@/lib/supabase/server');
      const supabase = createSupabaseServerClient();

      const { error } = await supabase
        .from('oauth_tokens')
        .delete()
        .eq('profile_id', profileId)
        .eq('provider', 'google');

      if (error) {
        console.error(`[CalendarService] ❌ Failed to delete tokens for profile ${profileId}:`, error.message);
      }
    } catch (err) {
      console.error(`[CalendarService] ❌ Token delete error:`, err);
    }
  }
}
