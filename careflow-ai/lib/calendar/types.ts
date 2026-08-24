/**
 * Calendar Integration Types
 *
 * Defines the abstract CalendarProvider interface and event shapes
 * for syncing CareFlow appointments with external calendars (Google, Outlook, etc.).
 *
 * Calendar sync is ALWAYS fire-and-forget:
 *   - Appointment booking/cancel/reschedule succeeds FIRST
 *   - Calendar sync happens AFTER, in the background
 *   - Calendar failure never blocks or rolls back the appointment
 */

// ============================================================
// Calendar event data (what we send to the calendar provider)
// ============================================================

export interface CalendarEventInput {
  /** The CareFlow appointment ID */
  appointmentId: string;
  /** CareFlow appointment date (YYYY-MM-DD) */
  date: string;
  /** Start time (HH:MM or HH:MM:SS) */
  startTime: string;
  /** End time (HH:MM or HH:MM:SS) */
  endTime: string;
  /** Event summary/title */
  summary: string;
  /** Event description (patient-friendly) */
  description?: string;
  /** Location string */
  location?: string;
  /** Timezone IANA string (e.g. 'Asia/Kolkata') */
  timezone?: string;
}

// ============================================================
// Calendar operation results
// ============================================================

export interface CalendarSyncSuccess {
  ok: true;
  /** External event ID from the calendar provider (e.g. Google event ID) */
  externalEventId: string;
  provider: string;
}

export interface CalendarSyncFailure {
  ok: false;
  provider: string;
  error: string;
  message: string;
}

export type CalendarSyncResult = CalendarSyncSuccess | CalendarSyncFailure;

// ============================================================
// Calendar Provider interface
// ============================================================

/**
 * Abstract calendar provider.
 * Each implementation (Mock, Google, Outlook) handles OAuth tokens,
 * API calls, and error mapping for one calendar service.
 *
 * Providers NEVER throw. They return CalendarSyncResult.
 */
export interface CalendarProvider {
  readonly provider: string;

  /**
   * Create a new calendar event.
   * Returns the external event ID on success.
   */
  createEvent(input: CalendarEventInput): Promise<CalendarSyncResult>;

  /**
   * Update an existing calendar event.
   * @param externalEventId - The provider's event ID from a previous createEvent call
   */
  updateEvent(
    externalEventId: string,
    input: CalendarEventInput
  ): Promise<CalendarSyncResult>;

  /**
   * Delete a calendar event.
   * @param externalEventId - The provider's event ID
   */
  deleteEvent(externalEventId: string): Promise<CalendarSyncResult>;
}

// ============================================================
// Calendar metadata stored per appointment
// ============================================================

export type CalendarProviderName = 'google' | 'outlook' | 'apple';
export type CalendarSyncStatus = 'pending' | 'synced' | 'failed' | 'deleted';
export type CalendarSyncRole = 'patient' | 'doctor';

export interface CalendarSyncRecord {
  id: string;
  appointmentId: string;
  profileId: string;
  provider: CalendarProviderName;
  role: CalendarSyncRole;
  externalEventId: string | null;
  syncStatus: CalendarSyncStatus;
  lastSyncError: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Token management (for OAuth providers like Google)
// ============================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  tokenType?: string;
}

export interface TokenStore {
  /**
   * Get stored tokens for a user profile.
   * Returns null if no tokens exist or tokens are invalid.
   */
  getTokens(profileId: string): Promise<OAuthTokens | null>;

  /**
   * Store/refresh tokens for a user profile.
   */
  setTokens(profileId: string, tokens: OAuthTokens): Promise<void>;

  /**
   * Delete tokens for a user profile (on disconnect/revoke).
   */
  deleteTokens(profileId: string): Promise<void>;
}
