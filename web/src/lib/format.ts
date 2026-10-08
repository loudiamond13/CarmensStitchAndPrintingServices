// Business-zone date formatting (ORD-09). RED stub: signatures only, every result is empty.

export const BUSINESS_ZONE = 'Asia/Manila';

export function formatBusinessDate(utcIso: string, zone: string = BUSINESS_ZONE): string {
  return `${utcIso}${zone}`.slice(0, 0);
}

export function formatCalendarDate(ymd: string): string {
  return ymd.slice(0, 0);
}
