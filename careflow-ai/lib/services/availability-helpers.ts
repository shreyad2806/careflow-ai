/**
 * Pure helper functions for availability slot generation.
 *
 * Extracted from availability.ts for direct unit testing.
 * These are stateless, side-effect-free functions that operate
 * on time strings and interval data.
 */

import type { AvailabilityWindow, TimeInterval } from '@/lib/services/availability';

/** Parse "HH:MM" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Check if two time intervals overlap (exclusive end) */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
         timeToMinutes(a.endTime) > timeToMinutes(b.startTime);
}

/** Check if a slot overlaps any interval in a list */
export function slotOverlapsIntervals(
  slotStart: number,
  slotEnd: number,
  intervals: TimeInterval[]
): boolean {
  for (const interval of intervals) {
    const intStart = timeToMinutes(interval.startTime);
    const intEnd = timeToMinutes(interval.endTime);
    if (slotStart < intEnd && slotEnd > intStart) {
      return true;
    }
  }
  return false;
}

/** Merge overlapping availability windows into non-overlapping ranges */
export function mergeWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  if (windows.length === 0) return [];

  // Sort by start time
  const sorted = [...windows].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const merged: AvailabilityWindow[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (timeToMinutes(next.startTime) <= timeToMinutes(current.endTime)) {
      // Overlapping or adjacent — merge by extending end time
      current.endTime = timeToMinutes(next.endTime) > timeToMinutes(current.endTime)
        ? next.endTime
        : current.endTime;
      // Use the shorter slot duration of the two
      current.slotDurationMinutes = Math.min(
        current.slotDurationMinutes,
        next.slotDurationMinutes
      );
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}
