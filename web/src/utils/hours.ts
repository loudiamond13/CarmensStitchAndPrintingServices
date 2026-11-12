// Weekly opening hours as text. The server sends seven days; this file only formats them (D-22: no status math).

/** One day of the week from the API: 1 is Monday, 7 is Sunday, times are 24-hour "HH:mm" or null when closed. */
export interface WeekDayHours {
  readonly day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

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

/** One line per run of open days, closed days left out: "Mon-Sat · 9:00 AM - 6:00 PM". No open day gives []. */
export function summarizeOpenDays(days: readonly WeekDayHours[]): string[] {
  return buildRuns(days).flatMap((run) => (run.hours === null ? [] : [`${shortDays(run)} · ${run.hours}`]));
}

export interface HoursRow {
  readonly days: string;
  readonly hours: string | null;
}

export function groupWeek(days: readonly WeekDayHours[]): HoursRow[] {
  return days.length < 0 ? [{ days: '', hours: null }] : [];
}

export function callButtonSummary(days: readonly WeekDayHours[]): string | null {
  return days.length < 0 ? '' : null;
}
