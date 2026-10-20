// The Audit Log's date range (UI-SPEC A1, D-26, WEB-10; AUDIT-02): the presets of the list toolkit plus "Everything kept", which
// is this page's own preset. A preset is stored in the URL by name and worked out against the business today on every visit;
// nothing here reads the machine clock, the caller passes today (businessToday). The window is the 8 months the log is kept
// (D-32), counted the way the server counts it.
import { z } from 'zod';
import { CUSTOM_RANGE, isCalendarDate, resolveRangePreset, type RangePreset } from '@/lib/url-state/parsers';
import { formatCalendarDate } from '@/utils/format';
import { AUDIT_COPY } from './auditCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

/** The kept window in months (D-32); the server's AuditRetention.Months. */
export const AUDIT_KEPT_MONTHS = 8;

/** The list toolkit's presets this page offers. */
export const AUDIT_PRESETS = [
  'last-7-days',
  'last-30-days',
  'this-month',
  'last-month',
] as const satisfies readonly RangePreset[];

/** Everything kept: the whole 8-month window up to today. */
export const ALL_RANGE = 'all';

/** The values of the `range` URL parameter, in the order the select lists them. */
export const AUDIT_RANGES = [...AUDIT_PRESETS, ALL_RANGE, CUSTOM_RANGE] as const;
export type AuditRange = (typeof AUDIT_RANGES)[number];

/** The range with no `range` in the URL. */
export const DEFAULT_AUDIT_RANGE = 'last-7-days' satisfies AuditRange;

/** The range part of the page's URL state. */
export interface AuditRangeState {
  range: AuditRange;
  from: string | null;
  to: string | null;
}

/** A resolved range of business days, both inclusive. */
export interface AuditDates {
  from: string;
  to: string;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function assertCalendarDate(value: string): [number, number, number] {
  if (!isCalendarDate(value)) {
    throw new RangeError('The business today must be a calendar date (YYYY-MM-DD).');
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return [year, month, day];
}

/**
 * The first day the log can be asked for: the same day 8 months before the business today, or that month's last day when it is
 * shorter (Oct 31 gives Feb 28), the same arithmetic as the server's validator.
 */
export function keptFloor(today: string): string {
  const [year, month, day] = assertCalendarDate(today);
  const months = year * 12 + (month - 1) - AUDIT_KEPT_MONTHS;
  const floorYear = Math.floor(months / 12);
  const floorMonth = months % 12;
  const lastDay = new Date(Date.UTC(floorYear, floorMonth + 1, 0)).getUTCDate();
  return `${pad(floorYear, 4)}-${pad(floorMonth + 1, 2)}-${pad(Math.min(day, lastDay), 2)}`;
}

/** The business days a range covers. A preset ignores any stray from and to. */
export function resolveAuditRange(state: AuditRangeState, today: string): AuditDates {
  if (state.range === ALL_RANGE) {
    return { from: keptFloor(today), to: today };
  }
  if (state.range === CUSTOM_RANGE) {
    // A custom range counts only when both dates pass the same checks as the inputs; until then the default stays.
    const draft = { from: state.from ?? '', to: state.to ?? '' };
    const errors = customRangeErrors(draft, today);
    return errors.from === null && errors.to === null ? draft : resolveRangePreset(DEFAULT_AUDIT_RANGE, today);
  }
  return resolveRangePreset(state.range, today);
}

/** The message under each custom-range date; null when that date is fine. */
export interface CustomRangeErrors {
  from: string | null;
  to: string | null;
}

/** The custom range's schema (OR-3): the rules of the server's validator, so the browser checks them before any request. */
function customRangeSchema(today: string) {
  const floor = keptFloor(today);
  const copy = AUDIT_COPY.errors;
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

/** What is wrong with the From and To inputs (empty text for no date), worked out against the business today. */
export function customRangeErrors(draft: { from: string; to: string }, today: string): CustomRangeErrors {
  const errors: CustomRangeErrors = { from: null, to: null };
  const result = customRangeSchema(today).safeParse(draft);
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
