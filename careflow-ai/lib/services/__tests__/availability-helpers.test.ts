/**
 * Unit tests for pure availability helper functions.
 *
 * These test the core logic independent of Supabase:
 *   - timeToMinutes / minutesToTime: time string ↔ numeric conversion
 *   - intervalsOverlap: two-interval overlap detection
 *   - slotOverlapsIntervals: slot vs. list overlap detection
 *   - mergeWindows: overlapping availability window merging
 */

import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  intervalsOverlap,
  slotOverlapsIntervals,
  mergeWindows,
} from '../availability-helpers';
import type { TimeInterval, AvailabilityWindow } from '../availability';

// ============================================================
// timeToMinutes
// ============================================================
describe('timeToMinutes', () => {
  it('converts midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 09:30', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });

  it('converts 12:00', () => {
    expect(timeToMinutes('12:00')).toBe(720);
  });

  it('converts 23:59', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('converts single-digit hour', () => {
    expect(timeToMinutes('8:15')).toBe(495);
  });
});

// ============================================================
// minutesToTime
// ============================================================
describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('converts 570 to 09:30', () => {
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('converts 720 to 12:00', () => {
    expect(minutesToTime(720)).toBe('12:00');
  });

  it('converts 1439 to 23:59', () => {
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('round-trips with timeToMinutes', () => {
    const times = ['00:00', '06:15', '09:30', '12:00', '17:45', '23:59'];
    for (const t of times) {
      expect(minutesToTime(timeToMinutes(t))).toBe(t);
    }
  });
});

// ============================================================
// intervalsOverlap
// ============================================================
describe('intervalsOverlap', () => {
  const apt = (s: string, e: string): TimeInterval => ({
    startTime: s,
    endTime: e,
    source: 'appointment',
  });

  it('detects overlapping intervals', () => {
    expect(intervalsOverlap(apt('09:00', '10:00'), apt('09:30', '10:30'))).toBe(true);
  });

  it('detects containment', () => {
    expect(intervalsOverlap(apt('09:00', '11:00'), apt('09:30', '10:30'))).toBe(true);
  });

  it('detects reverse containment', () => {
    expect(intervalsOverlap(apt('09:30', '10:30'), apt('09:00', '11:00'))).toBe(true);
  });

  it('returns false for adjacent non-overlapping', () => {
    expect(intervalsOverlap(apt('09:00', '10:00'), apt('10:00', '11:00'))).toBe(false);
  });

  it('returns false for non-overlapping', () => {
    expect(intervalsOverlap(apt('09:00', '10:00'), apt('11:00', '12:00'))).toBe(false);
  });

  it('returns false for gap between intervals', () => {
    expect(intervalsOverlap(apt('09:00', '09:30'), apt('10:00', '10:30'))).toBe(false);
  });
});

// ============================================================
// slotOverlapsIntervals
// ============================================================
describe('slotOverlapsIntervals', () => {
  const apt = (s: string, e: string): TimeInterval => ({
    startTime: s,
    endTime: e,
    source: 'appointment',
  });

  it('returns false for empty interval list', () => {
    expect(slotOverlapsIntervals(540, 570, [])).toBe(false);
  });

  it('detects overlap with single interval', () => {
    const intervals = [apt('09:00', '10:00')];
    // Slot 09:15–09:45 overlaps 09:00–10:00
    expect(slotOverlapsIntervals(555, 585, intervals)).toBe(true);
  });

  it('returns false when slot is before all intervals', () => {
    const intervals = [apt('10:00', '11:00')];
    expect(slotOverlapsIntervals(480, 540, intervals)).toBe(false);
  });

  it('returns false when slot is after all intervals', () => {
    const intervals = [apt('09:00', '10:00')];
    expect(slotOverlapsIntervals(720, 780, intervals)).toBe(false);
  });

  it('detects overlap with multiple intervals', () => {
    const intervals = [
      apt('09:00', '09:30'),
      apt('11:00', '11:30'),
    ];
    // Slot 10:45–11:15 overlaps second interval
    expect(slotOverlapsIntervals(645, 675, intervals)).toBe(true);
  });

  it('returns false when slot falls between intervals', () => {
    const intervals = [
      apt('09:00', '10:00'),
      apt('11:00', '12:00'),
    ];
    // Slot 10:15–10:45 is between both intervals
    expect(slotOverlapsIntervals(615, 645, intervals)).toBe(false);
  });
});

// ============================================================
// mergeWindows
// ============================================================
describe('mergeWindows', () => {
  const win = (s: string, e: string, dur: number): AvailabilityWindow => ({
    startTime: s,
    endTime: e,
    slotDurationMinutes: dur,
  });

  it('returns empty for no windows', () => {
    expect(mergeWindows([])).toEqual([]);
  });

  it('returns single window unchanged', () => {
    const windows = [win('09:00', '12:00', 30)];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(win('09:00', '12:00', 30));
  });

  it('merges two overlapping windows', () => {
    const windows = [
      win('09:00', '11:00', 30),
      win('10:00', '12:00', 30),
    ];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('12:00');
    expect(result[0].slotDurationMinutes).toBe(30); // min(30, 30)
  });

  it('merges adjacent windows', () => {
    const windows = [
      win('09:00', '10:00', 30),
      win('10:00', '11:00', 30),
    ];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('11:00');
  });

  it('keeps non-overlapping windows separate', () => {
    const windows = [
      win('09:00', '10:00', 30),
      win('11:00', '12:00', 30),
    ];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(2);
  });

  it('uses shorter slot duration on merge', () => {
    const windows = [
      win('09:00', '11:00', 30),
      win('10:00', '12:00', 15),
    ];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(1);
    expect(result[0].slotDurationMinutes).toBe(15); // min(30, 15)
  });

  it('handles three overlapping windows', () => {
    const windows = [
      win('09:00', '10:00', 30),
      win('09:30', '11:00', 20),
      win('10:30', '12:00', 30),
    ];
    const result = mergeWindows(windows);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('12:00');
    expect(result[0].slotDurationMinutes).toBe(20); // min(30, 20, 30)
  });

  it('does not mutate input array', () => {
    const windows = [
      win('09:00', '10:00', 30),
      win('10:00', '11:00', 30),
    ];
    const original = JSON.parse(JSON.stringify(windows));
    mergeWindows(windows);
    expect(windows).toEqual(original);
  });
});
