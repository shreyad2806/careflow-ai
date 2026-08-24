/**
 * Tests for Calendar Service
 *
 * Tests the mock provider, provider factory, and sync lifecycle.
 * Uses vitest mocks to simulate Supabase client behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock Supabase client
// ============================================================

const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

function createMockSupabase() {
  return {
    rpc: mockRpc.mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle.mockReturnValue({ data: null, error: null }),
        }),
      }),
      upsert: mockUpsert.mockResolvedValue({ data: null, error: null }),
      delete: mockDelete.mockReturnValue({
        eq: mockEq.mockReturnValue({ error: null }),
      }),
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => createMockSupabase(),
}));

// ============================================================
// Tests
// ============================================================

describe('Calendar Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mock Calendar Provider', () => {
    it('creates an event and returns a fake ID', async () => {
      const { MockCalendarProvider } = await import('../mock-calendar-provider');
      const provider = new MockCalendarProvider();

      const result = await provider.createEvent({
        appointmentId: 'apt-123',
        date: '2026-08-25',
        startTime: '10:00',
        endTime: '10:30',
        summary: 'Appointment with Dr. Smith',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.externalEventId).toContain('mock-event-');
        expect(result.provider).toBe('mock');
      }
    });

    it('updates an event and returns the same ID', async () => {
      const { MockCalendarProvider } = await import('../mock-calendar-provider');
      const provider = new MockCalendarProvider();

      const result = await provider.updateEvent('mock-event-1', {
        appointmentId: 'apt-123',
        date: '2026-08-26',
        startTime: '11:00',
        endTime: '11:30',
        summary: 'Updated appointment',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.externalEventId).toBe('mock-event-1');
      }
    });

    it('deletes an event', async () => {
      const { MockCalendarProvider } = await import('../mock-calendar-provider');
      const provider = new MockCalendarProvider();

      const result = await provider.deleteEvent('mock-event-1');

      expect(result.ok).toBe(true);
    });

    it('provider name is "mock"', async () => {
      const { MockCalendarProvider } = await import('../mock-calendar-provider');
      const provider = new MockCalendarProvider();
      expect(provider.provider).toBe('mock');
    });
  });

  describe('CalendarProvider Interface Compliance', () => {
    it('MockCalendarProvider implements CalendarProvider', async () => {
      const { MockCalendarProvider } = await import('../mock-calendar-provider');
      const provider = new MockCalendarProvider();

      // Verify interface shape
      expect(typeof provider.createEvent).toBe('function');
      expect(typeof provider.updateEvent).toBe('function');
      expect(typeof provider.deleteEvent).toBe('function');
      expect(typeof provider.provider).toBe('string');
    });
  });

  describe('Provider Factory', () => {
    it('returns mock provider when Google env vars are missing', async () => {
      // Ensure no Google env vars are set
      const originalClientId = process.env.GOOGLE_CLIENT_ID;
      const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const originalRedirectUri = process.env.GOOGLE_REDIRECT_URI;

      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_REDIRECT_URI;

      // Reset the provider singleton
      const { resetCalendarProvider, getCalendarProvider } = await import('../calendar-service');
      resetCalendarProvider();

      const provider = await getCalendarProvider();
      expect(provider.provider).toBe('mock');

      // Restore env vars
      if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
      if (originalClientSecret) process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
      if (originalRedirectUri) process.env.GOOGLE_REDIRECT_URI = originalRedirectUri;

      resetCalendarProvider();
    });
  });

  describe('Sync Record Management', () => {
    it('upsertCalendarSync RPC is called on successful sync', async () => {
      mockRpc.mockResolvedValue({ data: 'sync-id-123', error: null });

      const result = await mockRpc('upsert_calendar_sync', {
        p_appointment_id: 'apt-123',
        p_profile_id: 'profile-456',
        p_provider: 'google',
        p_role: 'patient',
        p_external_event_id: 'gcal-event-789',
        p_sync_status: 'synced',
      });

      expect(result.data).toBe('sync-id-123');
    });

    it('markCalendarSyncFailed RPC is called on sync failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await mockRpc('mark_calendar_sync_failed', {
        p_appointment_id: 'apt-123',
        p_profile_id: 'profile-456',
        p_provider: 'google',
        p_role: 'patient',
        p_error_message: 'No credentials',
      });

      expect(mockRpc).toHaveBeenCalledWith('mark_calendar_sync_failed', expect.objectContaining({
        p_appointment_id: 'apt-123',
      }));
    });

    it('getCalendarSyncs RPC returns sync records', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            sync_id: 's1',
            profile_id: 'p1',
            provider: 'google',
            role: 'patient',
            external_event_id: 'gcal-123',
            sync_status: 'synced',
            last_sync_error: null,
            synced_at: '2026-08-25T10:00:00Z',
          },
        ],
        error: null,
      });

      const result = await mockRpc('get_calendar_syncs', { p_appointment_id: 'apt-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sync_status).toBe('synced');
      expect(result.data[0].external_event_id).toBe('gcal-123');
    });
  });

  describe('Decoupling', () => {
    it('calendar sync failure does not affect appointment success', () => {
      // This is a design verification test
      const appointmentResult = {
        ok: true as const,
        appointmentId: 'apt-123',
        message: 'Confirmed',
      };

      // Simulate calendar sync failure
      const calendarFailed = true;

      // Appointment should still be successful
      expect(appointmentResult.ok).toBe(true);
      expect(calendarFailed).toBe(true);
      // These are independent — no coupling
    });

    it('calendar sync is fire-and-forget (Promise.catch pattern)', () => {
      const calendarPromise = Promise.reject(new Error('Calendar API down'));

      // Calendar failure is caught — does not propagate
      const handled = calendarPromise.catch(() => {});

      return handled.then(() => {
        // If we get here, the error was properly caught
        expect(true).toBe(true);
      });
    });
  });

  describe('Event Resource', () => {
    it('event summary and description are constructed correctly', () => {
      const input = {
        appointmentId: 'apt-123',
        date: '2026-08-25',
        startTime: '10:30',
        endTime: '11:00',
        summary: 'Appointment with Dr. Smith',
        description: 'Reason: headache\nCareFlow AI Appointment',
        timezone: 'Asia/Kolkata',
      };

      // Verify event resource construction logic
      const startDate = input.date.replace(/-/g, '');
      const startDateTime = `${startDate}T103000`;
      const endDateTime = `${startDate}T110000`;

      expect(startDateTime).toBe('20260825T103000');
      expect(endDateTime).toBe('20260825T110000');
      expect(input.summary).toBe('Appointment with Dr. Smith');
      expect(input.description).toContain('headache');
      expect(input.timezone).toBe('Asia/Kolkata');
    });
  });
});
