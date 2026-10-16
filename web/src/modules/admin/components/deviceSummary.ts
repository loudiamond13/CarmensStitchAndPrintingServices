// The strings of one S7 row (UI-SPEC "S7 Signed-in devices"): the device label, the "Signed in" time, the "Last active"
// text and the sign-out button's name. Times are Asia/Manila through formatBusinessDateTime, never the browser zone.
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';
import { formatBusinessDateTime } from '@/utils/format';

const MINUTE_MS = 60_000;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

/** The server's coarse label, or "Unknown browser" when it is blank. */
export function deviceLabel(item: SessionListItem): string {
  const label = item.device.trim();
  return label === '' ? AUTH_COPY.sessions.unknownBrowser : label;
}

/** "Oct 12, 2026, 3:42 PM", or null when the time cannot be read. */
export function signedInText(item: SessionListItem): string | null {
  return formatBusinessDateTime(item.signedInAt);
}

/**
 * "Active now" for this device; else "Just now", "{n} min ago" or "{n} hr ago" under a day, then the absolute time.
 * `now` is epoch milliseconds, passed in so the text is the same for the same data. Null when the time cannot be read.
 */
export function lastActiveText(item: SessionListItem, now: number): string | null {
  if (item.current) {
    return AUTH_COPY.sessions.activeNow;
  }
  const absolute = formatBusinessDateTime(item.lastActiveAt);
  if (absolute === null) {
    return null;
  }
  const minutes = Math.floor((now - Date.parse(item.lastActiveAt)) / MINUTE_MS);
  if (minutes < 1) {
    return AUTH_COPY.sessions.justNow;
  }
  if (minutes < MINUTES_PER_HOUR) {
    return AUTH_COPY.sessions.minutesAgo(minutes);
  }
  if (minutes < HOURS_PER_DAY * MINUTES_PER_HOUR) {
    return AUTH_COPY.sessions.hoursAgo(Math.floor(minutes / MINUTES_PER_HOUR));
  }
  return absolute;
}

/** The sign-out button's name: the device and when it signed in, so identical devices stay distinct. */
export function rowSignOutName(item: SessionListItem): string {
  return AUTH_COPY.sessions.rowAction(deviceLabel(item), signedInText(item));
}

/** Last active as epoch milliseconds; an unreadable time sorts last. */
function lastActiveMs(item: SessionListItem): number {
  const ms = Date.parse(item.lastActiveAt);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/** Display order: this device first, then the others by last active, newest first. A new array. */
export function orderDevices(items: readonly SessionListItem[]): SessionListItem[] {
  return items
    .map((item, position) => ({ item, position }))
    .sort((a, b) => {
      if (a.item.current !== b.item.current) {
        return a.item.current ? -1 : 1;
      }
      const byActivity = lastActiveMs(b.item) - lastActiveMs(a.item);
      return Number.isNaN(byActivity) || byActivity === 0 ? a.position - b.position : byActivity;
    })
    .map(({ item }) => item);
}
