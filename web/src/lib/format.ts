// Money and date formatting (ORD-09): `₱12,450.00`, `−₱732.50` (U+2212) and `Oct 6, 2026`.
// One import for callers: formatPeso and formatDate are App. D.1's (src/lib/csps.ts); formatBusinessDate is added here.
export { formatDate, formatPeso } from '@/lib/csps';

/** The business zone default (SiteSettings holds the real value; Manager-editable later). */
const BUSINESS_ZONE = 'Asia/Manila';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' });
    formatters.set(zone, formatter);
  }
  return formatter;
}

/**
 * "Oct 6, 2026": the business-zone calendar date of a UTC instant (an ISO timestamp from the API). For plain
 * YYYY-MM-DD business dates use formatDate, which reads them as calendar dates. Empty or invalid input gives "—".
 */
export function formatBusinessDate(utcIso: string, zone = BUSINESS_ZONE): string {
  const instant = new Date(utcIso);
  if (Number.isNaN(instant.getTime())) return '—';
  return formatterFor(zone).format(instant);
}
