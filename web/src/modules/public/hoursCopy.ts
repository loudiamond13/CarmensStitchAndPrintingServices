// The words of the Contact hours card and the open status (UI-SPEC Copywriting "HoursCard"; PUB-05, D-22). They sit apart
// from copy.ts because only the lazy hours parts use them, and copy.ts reaches every public page's first download (PERF-01).
// SPEC-GAP: the status lines are built from the server's facts and these words only.
import { dayName, formatTime } from '@/utils/hours';
import type { OpenStatus } from './services/siteService';

export const HOURS_COPY = {
  title: 'Business hours',
  open: 'Open now',
  closed: 'Closed now',
  closedOn: 'Closed on',
  closedRow: 'Closed',
  status: {
    closes: (time: string) => `Closes ${time}.`,
    opens: (when: string, time: string) => `Opens ${when} ${time}.`,
    today: 'today',
    tomorrow: 'tomorrow',
    closedToday: 'Closed today.',
    closedTodayFor: (note: string) => `Closed today for ${note}.`,
  },
} as const;

/** The Contact status line from the server's facts (D-22), or null when there is nothing to say. */
export function statusLine(status: OpenStatus): string | null {
  const words = HOURS_COPY.status;
  if (status.isOpen) {
    const closes = status.closesAt === null ? null : formatTime(status.closesAt);
    return closes === null ? null : words.closes(closes);
  }
  const note = status.todayClosureNote?.trim() ?? '';
  const closed = status.closedToday ? (note === '' ? words.closedToday : words.closedTodayFor(note)) : null;
  const next = status.nextOpening;
  const time = next === null ? null : formatTime(next.opensAt);
  const day =
    next === null
      ? null
      : next.when === 'today'
        ? words.today
        : next.when === 'tomorrow'
          ? words.tomorrow
          : dayName(Number(next.day));
  const opens = time === null || day === null ? null : words.opens(day, time);
  return [closed, opens].filter((part) => part !== null).join(' ') || null;
}
