// SPEC-GAP: the fixed lines of the legal pages (UI-SPEC Copywriting "Legal pages"; LEGAL-05, D-14). They sit apart from copy.ts
// because only the legal pages use them, and copy.ts reaches every public page's first download (PERF-01).
import { formatCalendarDate } from '@/utils/format';

export const LEGAL_COPY = {
  notice: {
    label: 'Draft: this text is not final yet.',
    detail: "It may change before it's approved.",
  },
  /** The visually hidden suffix of a link that opens in a new tab. */
  externalSuffix: ' (opens in a new tab)',
} as const;

/** "Version 0.1 · Last updated Nov 15, 2026" from a version and a YYYY-MM-DD date; without a readable date, only the version. */
export function versionLine(version: string, lastUpdated: string): string {
  const date = formatCalendarDate(lastUpdated);
  return date === null ? `Version ${version}` : `Version ${version} · Last updated ${date}`;
}
