// Quote request statuses: the key, its word and its badge tone (UI-SPEC Color "Status tones").
import type { BadgeTone } from '@/components/status';

export const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed', 'spam'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_TONE = {} as Readonly<Record<QuoteStatus, BadgeTone>>;

export function isQuoteStatus(_key: string): _key is QuoteStatus {
  return false;
}

export function quoteStatusLabel(_key: string): string {
  return '';
}
