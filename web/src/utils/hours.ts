// Weekly opening hours as text. The server sends seven days; this file only formats them (D-22: no status math).

/** One day of the week from the API: 1 is Monday, 7 is Sunday, times are 24-hour "HH:mm" or null when closed. */
export interface WeekDayHours {
  readonly day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** The full weekday for the server's day number (1 is Monday, 7 is Sunday); any other number gives null. */
export function dayName(day: number): string | null {
  return LONG_DAYS[day - 1] ?? null;
}

const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "9:00 AM" for "09:00", "12:00 AM" for "00:00". Text that is not a 24-hour time gives null. */
export function formatTime(hhmm: string): string | null {
  const match = TIME_24H.exec(hhmm);
  if (match === null) return null;
  const hour = Number(match[1]);
  return `${String(hour % 12 || 12)}:${match[2] ?? '00'} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** A run of consecutive days (0 is Monday) that share the same hours; null hours means closed. */
interface Run {
  readonly first: number;
  last: number;
  readonly hours: string | null;
}

/** "9:00 AM - 6:00 PM", or null when the day is closed or either time is not a valid "HH:mm". */
function hoursOf(entry: WeekDayHours | undefined): string | null {
  if (entry?.opensAt == null || entry.closesAt === null) return null;
  const opens = formatTime(entry.opensAt);
  const closes = formatTime(entry.closesAt);
  return opens === null || closes === null ? null : `${opens} - ${closes}`;
}

/** Monday-first runs over the seven days; a day the server left out counts as closed. */
function buildRuns(days: readonly WeekDayHours[]): Run[] {
  const byDay = new Map(days.map((entry) => [entry.day, entry]));
  const runs: Run[] = [];
  for (let index = 0; index < SHORT_DAYS.length; index++) {
    const hours = hoursOf(byDay.get((index + 1) as WeekDayHours['day']));
    const previous = runs.at(-1);
    if (previous?.hours === hours) previous.last = index;
    else runs.push({ first: index, last: index, hours });
  }
  return runs;
}

/** "Mon-Sat" for a run of days, "Sat" for a single day. */
function shortDays(run: Run): string {
  const first = SHORT_DAYS[run.first] ?? '';
  const last = SHORT_DAYS[run.last] ?? '';
  return run.first === run.last ? first : `${first}-${last}`;
}

/** "Monday to Saturday" for a run of days, "Saturday" for a single day. */
function longDays(run: Run): string {
  const first = LONG_DAYS[run.first] ?? '';
  const last = LONG_DAYS[run.last] ?? '';
  return run.first === run.last ? first : `${first} to ${last}`;
}

/** One line per run of open days, closed days left out: "Mon-Sat · 9:00 AM - 6:00 PM". No open day gives []. */
export function summarizeOpenDays(days: readonly WeekDayHours[]): string[] {
  return buildRuns(days).flatMap((run) => (run.hours === null ? [] : [`${shortDays(run)} · ${run.hours}`]));
}

/** One row of the hours card: the days as text and their hours, null when closed (the card writes Closed). */
export interface HoursRow {
  readonly days: string;
  readonly hours: string | null;
}

/** The card rows, Monday first: runs of consecutive days with the same hours, closed runs included. */
export function groupWeek(days: readonly WeekDayHours[]): HoursRow[] {
  return buildRuns(days).map((run) => ({ days: longDays(run), hours: run.hours }));
}

/** The Call button sub line: "Mon-Sat, 9:00 AM - 6:00 PM", runs joined by "; ". No open day gives null. */
export function callButtonSummary(days: readonly WeekDayHours[]): string | null {
  const parts = buildRuns(days).flatMap((run) => (run.hours === null ? [] : [`${shortDays(run)}, ${run.hours}`]));
  return parts.length === 0 ? null : parts.join('; ');
}
