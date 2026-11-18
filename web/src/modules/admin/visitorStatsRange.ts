// The Visitor Stats date range (UI-SPEC V1, D-24, D-04, WEB-10; ANL-08). SPEC-GAP: V1. The five presets the server offers plus
// Custom. A preset is sent by name and the server works out its days, so the browser never computes a default range. A custom
// range is checked here with the server's own rules and words (OR-3) before any request; the caller passes the business today.
import { z } from 'zod';
import { CUSTOM_RANGE, isCalendarDate, type DateRangeState, type RangePreset } from '@/lib/url-state/parsers';
import type { VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';
import { formatCalendarDate } from '@/utils/format';
import { VISITOR_STATS_COPY } from './visitorStatsCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

/** The years of daily totals kept (D-04); the server's AnalyticsRetention.DailyYears. */
export const STATS_KEPT_YEARS = 3;

/** The server's presets (StatsRangePresets), in the order the select lists them. */
export const STATS_PRESETS = [
  'last-7-days',
  'last-30-days',
  'this-month',
  'last-month',
  'this-year',
] as const satisfies readonly RangePreset[];
export type StatsPreset = (typeof STATS_PRESETS)[number];

/** The values of the `range` URL parameter. */
export const STATS_RANGES = [...STATS_PRESETS, CUSTOM_RANGE] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

/** The range with no `range` in the URL (D-24). */
export const DEFAULT_STATS_RANGE = 'last-30-days' satisfies StatsPreset;

export type StatsRangeState = DateRangeState<StatsPreset>;

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** The earliest day a custom range may start: the same day 3 years back, Feb 29 becoming Feb 28 (DateOnly.AddYears). */
export function statsFloor(today: string): string {
  if (!isCalendarDate(today)) {
    throw new RangeError('The business today must be a calendar date (YYYY-MM-DD).');
  }
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const floorYear = year - STATS_KEPT_YEARS;
  const lastDay = new Date(Date.UTC(floorYear, month, 0)).getUTCDate();
  return `${pad(floorYear, 4)}-${pad(month, 2)}-${pad(Math.min(day, lastDay), 2)}`;
}

/** The custom range's schema (OR-3): the rules of the server's VisitorStatsRequestValidator, in its words. */
export function statsCustomRangeSchema(today: string) {
  const floor = statsFloor(today);
  const copy = VISITOR_STATS_COPY.errors;
  const inWindow = (day: string): boolean => day >= floor && day <= today;
  const date = (required: string) =>
    z
      .string()
      .min(1, required)
      .refine(isCalendarDate, copy.notReal)
      .refine(inWindow, copy.outsideWindow(formatCalendarDate(floor) ?? floor));
  return z.object({ from: date(copy.startRequired), to: date(copy.endRequired) }).superRefine((range, context) => {
    const bothFine = [range.from, range.to].every((day) => isCalendarDate(day) && inWindow(day));
    if (bothFine && range.from > range.to) {
      context.addIssue({ code: 'custom', path: ['from'], message: copy.order });
    }
  });
}

/** The message under each custom-range date; null when that date is fine. */
export interface StatsCustomRangeErrors {
  from: string | null;
  to: string | null;
}

/** What is wrong with the From and To inputs (empty text for no date), against the business today. */
export function statsCustomRangeErrors(draft: { from: string; to: string }, today: string): StatsCustomRangeErrors {
  const errors: StatsCustomRangeErrors = { from: null, to: null };
  const result = statsCustomRangeSchema(today).safeParse(draft);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if ((field === 'from' || field === 'to') && errors[field] === null) {
        errors[field] = issue.message;
      }
    }
  }
  return errors;
}

/**
 * The request for the URL's range: a preset by name alone; a custom range once both dates pass the checks. Null for a custom
 * range that does not pass yet (or while today is unknown), so the page keeps the range it last applied.
 */
export function statsQueryFor(state: StatsRangeState, today: string | null): VisitorStatsQuery | null {
  if (state.range !== CUSTOM_RANGE) {
    return { range: state.range, from: null, to: null };
  }
  if (today === null || state.from === null || state.to === null) return null;
  const errors = statsCustomRangeErrors({ from: state.from, to: state.to }, today);
  return errors.from === null && errors.to === null ? { range: CUSTOM_RANGE, from: state.from, to: state.to } : null;
}
