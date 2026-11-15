// The weekly hours as the formatters read them (PUB-02, D-21). Only the lazy hours parts import this and utils/hours, so
// no public page pays for them in its first download (PERF-01).
import type { WeekDayHours } from '@/utils/hours';
import type { PublicSite } from './services/siteService';

/** The seven days: the API's day number can arrive as text, and a day that is not 1 to 7 is dropped. */
export function weekHours(site: PublicSite): WeekDayHours[] {
  return site.hours.flatMap((entry) => {
    const day = Number(entry.day);
    return Number.isInteger(day) && day >= 1 && day <= 7
      ? [{ day: day as WeekDayHours['day'], opensAt: entry.opensAt, closesAt: entry.closesAt }]
      : [];
  });
}
