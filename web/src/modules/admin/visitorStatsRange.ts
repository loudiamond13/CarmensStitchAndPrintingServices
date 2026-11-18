// RED stub (plan 12-23): the range module is built in the GREEN commit.
import { z } from 'zod';

z.config({ jitless: true });

export const STATS_PRESETS: readonly string[] = [];
export const STATS_RANGES: readonly string[] = [];
export const DEFAULT_STATS_RANGE = '';
export const STATS_KEPT_YEARS = 0;

export function statsFloor(today: string): string {
  return today;
}

export function statsCustomRangeSchema(today: string) {
  void today;
  return z.object({});
}

export function statsCustomRangeErrors(
  draft: { from: string; to: string },
  today: string,
): { from: string | null; to: string | null } {
  void draft;
  void today;
  return { from: null, to: null };
}

export function statsQueryFor(state: unknown, today: string | null): null {
  void state;
  void today;
  return null;
}
