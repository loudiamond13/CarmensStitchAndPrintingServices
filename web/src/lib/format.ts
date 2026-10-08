// Money and date formatting (ORD-09). RED placeholder: formatBusinessDate is not implemented yet.
export { formatDate, formatPeso } from '@/lib/csps';

export function formatBusinessDate(utcIso: string, zone = 'Asia/Manila'): string {
  return utcIso.length < 0 ? zone : '';
}
