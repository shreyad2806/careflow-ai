/**
 * Availability service integration tests — 10 deterministic scenarios.
 *
 * Strategy:
 *   - Mock Supabase at the module level via vi.mock()
 *   - Use deterministic, future-dated dates (2030) to avoid past-date filtering
 *   - Each test configures exactly the mock data it needs
 *   - No real database required — runs purely in-memory
 *
 * Access: `npm test` (vitest run)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock Supabase — table-name–based, stateless
// ============================================================

interface TableResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: null | { message: string };
}

/** Current mock responses keyed by table name. Reset per test. */
const mockResponses: Record<string, TableResponse> = {};

/**
 * Configure the mock response for a given table.
 * Call this in beforeEach or individual tests.
 */
function setTableResponse(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  error: null | { message: string } = null
) {
  mockResponses[table] = { data, error };
}

/**
 * Create a fake Supabase client that resolves queries by table name.
 *
 * Supports the chainable pattern:
 *   from('table').select(...).eq(...).eq(...) → awaits to { data, error }
 *   from('table').select(...).eq(...).single() → resolves to { data, error }
 */
function createMockClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveForTable = (table: string): any =>
    mockResponses[table] ?? { data: null, error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createBuilder = (table: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = (): any => builder;

    const builder = {
      // Chainable query methods (all return the builder itself)
      select: chain,
      eq: chain,
      in: chain,
      gt: chain,
      gte: chain,
      lte: chain,
      order: chain,
      limit: chain,
      delete: chain,

      // Terminal async methods — return the table's mock response
      single: () => Promise.resolve(resolveForTable(table)),
      maybeSingle: () => Promise.resolve(resolveForTable(table)),

      // Make the builder itself thenable so `await builder` works
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(resolveForTable(table)).then(resolve, reject),
    };

    return builder;
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string): any => createBuilder(table),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: (): any => Promise.resolve({ data: null, error: null }),
  };
}

// ============================================================
// Mock the Supabase server module BEFORE importing the service
// ============================================================

const mockClient = createMockClient();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => mockClient,
}));

// ============================================================
// Import the service (vi.mock is hoisted, mock is active)
// ============================================================

import {
  generateAvailableSlots,
} from '../availability';

// ============================================================
// Deterministic test constants — all future dates (2030)
// ============================================================

const DOC_ID = '00000000-0000-0000-0000-000000000001';

// 2030-01-06 = Monday (day_of_week = 1)
const MONDAY = '2030-01-06';



// 2020-01-06 = Monday in the past
const PAST_MONDAY = '2020-01-06';

// ============================================================
// Setup — clear mock responses before each test
// ============================================================

beforeEach(() => {
  // Clear all mock responses
  for (const key of Object.keys(mockResponses)) {
    delete mockResponses[key];
  }
});

// ============================================================
// Helper to set up standard "doctor exists, availability, no exclusions"
// ============================================================

function setupStandardMocks(opts: {
  availabilityDay?: number; // day_of_week to filter availability
  availabilityWindows?: Array<{
    id?: string;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    day_of_week?: number;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appointments?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  holds?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaves?: any[];
  doctorNotFound?: boolean;
}) {
  const dayOfWeek = opts.availabilityDay ?? 1; // default Monday
  const windows = opts.availabilityWindows ?? [
    { id: '1', start_time: '09:00:00', end_time: '12:00:00', slot_duration_minutes: 30, day_of_week: dayOfWeek },
  ];

  // Doctor lookup → single() returns this
  setTableResponse('doctors', opts.doctorNotFound ? null : { id: DOC_ID });

  // Availability window query
  setTableResponse('doctor_availability', opts.doctorNotFound ? [] : windows);

  // Leaves query
  setTableResponse('doctor_leaves', opts.leaves ?? []);

  // Appointments query (booked intervals)
  setTableResponse('appointments', opts.appointments ?? []);

  // Holds query (active hold intervals)
  setTableResponse('slot_holds', opts.holds ?? []);
}

// ============================================================
// TEST 1: Doctor has availability, no conflicts
// Expected: All future slots are generated
// ============================================================

describe('TEST 1: Doctor has availability, no conflicts', () => {
  it('generates all 6 expected slots for a clear 09:00-12:00 day at 30min intervals', async () => {
    setupStandardMocks({ availabilityDay: 1 });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 09:00-12:00 at 30-min intervals = 6 slots
    expect(result.slots).toHaveLength(6);
    expect(result.slots[0]).toEqual({ startTime: '09:00', endTime: '09:30', isPast: false });
    expect(result.slots[5]).toEqual({ startTime: '11:30', endTime: '12:00', isPast: false });
    expect(result.excludedIntervals).toHaveLength(0);
  });
});

// ============================================================
// TEST 2: A confirmed appointment exists
// Expected: The exact conflicting slot is excluded
// ============================================================

describe('TEST 2: Confirmed appointment excludes slot', () => {
  it('excludes 10:00-10:30 when a confirmed appointment occupies it', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      appointments: [
        { start_time: '10:00:00', end_time: '10:30:00', status: 'CONFIRMED' },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 5 slots remaining (10:00-10:30 excluded)
    expect(result.slots).toHaveLength(5);

    // Verify the booked slot is NOT in the output
    expect(result.slots.some(s => s.startTime === '10:00')).toBe(false);

    // Verify excluded intervals contain the appointment
    expect(result.excludedIntervals).toHaveLength(1);
    expect(result.excludedIntervals[0].source).toBe('appointment');
    expect(result.excludedIntervals[0].startTime).toBe('10:00');
  });

  it('excludes both 09:00 and 09:30 when a 60-minute appointment is at 09:00', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      appointments: [
        { start_time: '09:00:00', end_time: '10:00:00', status: 'CONFIRMED' },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 09:00-10:00 blocks both 30min slots → 4 remaining
    expect(result.slots).toHaveLength(4);
    expect(result.slots.some(s => s.startTime === '09:00')).toBe(false);
    expect(result.slots.some(s => s.startTime === '09:30')).toBe(false);
  });
});

// ============================================================
// TEST 3: An active slot hold exists
// Expected: The held slot is excluded
// ============================================================

describe('TEST 3: Active hold excludes slot', () => {
  it('excludes 11:00-11:30 when an active hold occupies it', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      holds: [
        { start_time: '11:00:00', end_time: '11:30:00' },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 5 slots remaining (11:00-11:30 excluded)
    expect(result.slots).toHaveLength(5);
    expect(result.slots.some(s => s.startTime === '11:00')).toBe(false);

    // Verify excluded interval source
    expect(result.excludedIntervals).toHaveLength(1);
    expect(result.excludedIntervals[0].source).toBe('hold');
    expect(result.excludedIntervals[0].startTime).toBe('11:00');
  });

  it('excludes slot when both a hold and an appointment exist on different slots', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      appointments: [{ start_time: '10:00:00', end_time: '10:30:00', status: 'CONFIRMED' }],
      holds: [{ start_time: '11:00:00', end_time: '11:30:00' }],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 4 slots remaining (both excluded)
    expect(result.slots).toHaveLength(4);
    expect(result.excludedIntervals).toHaveLength(2);
  });
});

// ============================================================
// TEST 4: A slot hold has expired
// Expected: The slot becomes available again
// ============================================================

describe('TEST 4: Expired hold does NOT exclude slot', () => {
  it('returns all slots when hold query returns empty (expired)', async () => {
    // Empty holds array simulates an expired hold — the gt() filter in the
    // service filters out expired holds, so we return empty
    setupStandardMocks({
      availabilityDay: 1,
      holds: [], // expired hold not returned by query
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All 6 slots present — expired hold doesn't block anything
    expect(result.slots).toHaveLength(6);
    expect(result.excludedIntervals).toHaveLength(0);
  });
});

// ============================================================
// TEST 5: Doctor is on leave
// Expected: Affected slots are excluded (returns doctor_on_leave)
// ============================================================

describe('TEST 5: Doctor is on leave', () => {
  it('returns doctor_on_leave error when approved leave exists', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      leaves: [
        { start_date: '2030-01-06', end_date: '2030-01-06', status: 'approved' },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('doctor_on_leave');
  });

  it('returns slots normally when no leave exists', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      leaves: [],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(true);
  });
});

// ============================================================
// TEST 6: Two availability windows overlap
// Expected: No duplicate slots are returned (windows are merged)
// ============================================================

describe('TEST 6: Overlapping availability windows are merged', () => {
  it('merges 09:00-11:00 and 10:00-12:00 into 09:00-12:00 with 6 unique slots', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      availabilityWindows: [
        { id: '1', start_time: '09:00:00', end_time: '11:00:00', slot_duration_minutes: 30, day_of_week: 1 },
        { id: '2', start_time: '10:00:00', end_time: '12:00:00', slot_duration_minutes: 30, day_of_week: 1 },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Merged window: 09:00–12:00 → 6 unique slots (no duplicates)
    expect(result.slots).toHaveLength(6);

    // Verify all start times are unique
    const startTimes = result.slots.map(s => s.startTime);
    const unique = new Set(startTimes);
    expect(unique.size).toBe(result.slots.length);

    // Should show 1 merged window
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0].startTime).toBe('09:00');
    expect(result.windows[0].endTime).toBe('12:00');
  });

  it('handles two separate (non-overlapping) windows without merging', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      availabilityWindows: [
        { id: '1', start_time: '09:00:00', end_time: '10:00:00', slot_duration_minutes: 30, day_of_week: 1 },
        { id: '2', start_time: '14:00:00', end_time: '15:00:00', slot_duration_minutes: 30, day_of_week: 1 },
      ],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 09:00–10:00 = 2 slots, 14:00–15:00 = 2 slots = 4 total
    expect(result.slots).toHaveLength(4);
    expect(result.windows).toHaveLength(2);
  });
});

// ============================================================
// TEST 7: Availability is entirely in the past
// Expected: No past slots are returned
// ============================================================

describe('TEST 7: Past date returns no slots', () => {
  it('returns past_date error for a date in the past', async () => {
    setupStandardMocks({ availabilityDay: 1 });

    const result = await generateAvailableSlots(DOC_ID, PAST_MONDAY);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('past_date');
  });

  it('generates slots for a valid future date', async () => {
    setupStandardMocks({ availabilityDay: 1 });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(true);
  });
});

// ============================================================
// TEST 8: Invalid or malformed availability data
// Expected: Safe failure without crashing unrelated pages
// ============================================================

describe('TEST 8: Invalid or malformed input data', () => {
  it('returns invalid_date for malformed date string', async () => {
    const result = await generateAvailableSlots(DOC_ID, 'not-a-date');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_date');
  });

  it('returns invalid_date for empty string', async () => {
    const result = await generateAvailableSlots(DOC_ID, '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_date');
  });

  it('returns invalid_date for wrong format (DD-MM-YYYY)', async () => {
    const result = await generateAvailableSlots(DOC_ID, '06-01-2030');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_date');
  });

  it('returns doctor_not_found for non-existent doctor', async () => {
    setupStandardMocks({ doctorNotFound: true });

    const result = await generateAvailableSlots('non-existent-id', MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('doctor_not_found');
  });

  it('returns no_availability when doctor has no windows on this day', async () => {
    // Set availability for Wednesday (day 3) only, test against Monday (day 1)
    setupStandardMocks({
      availabilityDay: 3, // availability exists for Wednesday
      availabilityWindows: [
        { id: '1', start_time: '09:00:00', end_time: '12:00:00', slot_duration_minutes: 30, day_of_week: 3 },
      ],
    });
    // Override: for Monday query, return empty (simulating no windows for day 1)
    setTableResponse('doctor_availability', []);

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no_availability');
  });
});

// ============================================================
// TEST 9: Supabase query returns an empty valid result
// Expected: Return empty slots, not mock slots
// ============================================================

describe('TEST 9: Empty query results', () => {
  it('returns no_availability for empty availability data', async () => {
    setupStandardMocks({ availabilityDay: 1 });
    // Override availability to return empty array
    setTableResponse('doctor_availability', []);

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no_availability');
  });

  it('returns all slots when appointments, holds, and leaves are all empty', async () => {
    setupStandardMocks({
      availabilityDay: 1,
      appointments: [],
      holds: [],
      leaves: [],
    });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All 6 slots should be present — empty exclusions
    expect(result.slots).toHaveLength(6);
    expect(result.excludedIntervals).toHaveLength(0);
  });

  it('returns slots as array (not mock/placeholder data)', async () => {
    setupStandardMocks({ availabilityDay: 1 });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Verify slots are real objects with startTime/endTime
    for (const slot of result.slots) {
      expect(slot).toHaveProperty('startTime');
      expect(slot).toHaveProperty('endTime');
      expect(slot).toHaveProperty('isPast');
      expect(slot.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.endTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

// ============================================================
// TEST 10: Supabase query fails
// Expected: Log the real sanitized error clearly
// ============================================================

describe('TEST 10: Supabase query failure', () => {
  it('returns no_availability when availability query returns error', async () => {
    setupStandardMocks({ availabilityDay: 1 });
    // Override: simulate a Supabase error on the availability query
    setTableResponse('doctor_availability', null, { message: 'Connection refused' });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);

    // Service treats error as no data → no_availability
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no_availability');
  });

  it('returns slots normally after a successful doctor check', async () => {
    setupStandardMocks({ availabilityDay: 1 });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(true);
  });

  it('handles Supabase returning null data gracefully (no crash)', async () => {
    setupStandardMocks({ availabilityDay: 1 });
    // Override: simulate null data from all queries
    setTableResponse('doctor_availability', null);
    setTableResponse('doctor_leaves', null);
    setTableResponse('appointments', null);
    setTableResponse('slot_holds', null);

    // Should fail gracefully (no_availability), not throw
    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(false);
  });

  it('returns doctor_not_found when doctor query returns error', async () => {
    setupStandardMocks({ availabilityDay: 1 });
    setTableResponse('doctors', null, { message: 'Connection refused' });

    const result = await generateAvailableSlots(DOC_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('doctor_not_found');
  });
});
