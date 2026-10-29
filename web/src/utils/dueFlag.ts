// Due-date day counts and flag states (ORD-11, D-36 to D-38). Plain calendar-date text in, whole days out: no time zone.
import { formatCalendarDate } from './format';

export type DueFlagKind = 'none' | 'date-only' | 'days-left' | 'tomorrow' | 'today' | 'overdue';

export interface DueFlagState {
  readonly kind: DueFlagKind;
  /** Days left for 'days-left', days past due for 'overdue', otherwise 0. */
  readonly days: number;
}

const DAY_MS = 86_400_000;

// Only these statuses can be late; a delivered, completed or cancelled order shows its date alone (D-37).
const OPEN_STATUSES: ReadonlySet<string> = new Set(['pending', 'mockup', 'production', 'ready']);

function utcMidnight(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/** Whole calendar days from `today` to `dueDate` (negative when past due). Both are real YYYY-MM-DD dates, else a RangeError. */
export function dueDays(today: string, dueDate: string): number {
  if (formatCalendarDate(today) === null || formatCalendarDate(dueDate) === null) {
    throw new RangeError('dueDays needs two YYYY-MM-DD dates');
  }
  return Math.round((utcMidnight(dueDate) - utcMidnight(today)) / DAY_MS);
}

/** What the due flag shows. A missing or unreadable due date has no flag, and an unreadable today leaves the date alone. */
export function dueFlagState(today: string, dueDate: string | null, status: string): DueFlagState {
  if (dueDate === null || formatCalendarDate(dueDate) === null) return { kind: 'none', days: 0 };
  if (!OPEN_STATUSES.has(status) || formatCalendarDate(today) === null) return { kind: 'date-only', days: 0 };
  const days = dueDays(today, dueDate);
  if (days < 0) return { kind: 'overdue', days: -days };
  if (days === 0) return { kind: 'today', days: 0 };
  if (days === 1) return { kind: 'tomorrow', days: 1 };
  return { kind: 'days-left', days };
}
