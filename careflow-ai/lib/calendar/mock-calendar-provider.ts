/**
 * Mock Calendar Provider
 *
 * Used in development and tests. Simulates calendar operations
 * without making any external API calls. Generates fake event IDs
 * and logs all operations to the console.
 *
 * Always returns success — never simulates failures.
 * For failure testing, use the GoogleCalendarProvider with invalid credentials.
 */

import type { CalendarProvider, CalendarEventInput, CalendarSyncResult } from './types';

export class MockCalendarProvider implements CalendarProvider {
  readonly provider = 'mock';

  private eventCounter = 0;

  async createEvent(input: CalendarEventInput): Promise<CalendarSyncResult> {
    this.eventCounter++;
    const fakeEventId = `mock-event-${this.eventCounter}-${Date.now()}`;

    console.log(
      `[CalendarService] 📅 MOCK CREATE id=${input.appointmentId} event=${fakeEventId}\n` +
      `  summary: ${input.summary}\n` +
      `  date: ${input.date} ${input.startTime}–${input.endTime}`
    );

    return {
      ok: true,
      externalEventId: fakeEventId,
      provider: 'mock',
    };
  }

  async updateEvent(
    externalEventId: string,
    input: CalendarEventInput
  ): Promise<CalendarSyncResult> {
    console.log(
      `[CalendarService] 📅 MOCK UPDATE id=${input.appointmentId} event=${externalEventId}\n` +
      `  new date: ${input.date} ${input.startTime}–${input.endTime}`
    );

    return {
      ok: true,
      externalEventId,
      provider: 'mock',
    };
  }

  async deleteEvent(externalEventId: string): Promise<CalendarSyncResult> {
    console.log(
      `[CalendarService] 📅 MOCK DELETE event=${externalEventId}`
    );

    return {
      ok: true,
      externalEventId,
      provider: 'mock',
    };
  }
}
