// Quote request statuses: the key, its word and its badge tone (UI-SPEC Color "Status tones"). Each badge also shows its
// word and dot, so color is never the only cue.
import type { BadgeTone } from '@/components/status';

export const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed', 'spam'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Readonly<Record<QuoteStatus, string>> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  converted: 'Converted',
  closed: 'Closed',
  spam: 'Spam',
};

export const QUOTE_STATUS_TONE: Readonly<Record<QuoteStatus, BadgeTone>> = {
  new: 'accent',
  contacted: 'info',
  quoted: 'mockup',
  converted: 'success',
  closed: 'neutral',
  spam: 'danger',
};

export function isQuoteStatus(key: string): key is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(key);
}

/** The word of a status key; a key the types do not know shows as sent. */
export function quoteStatusLabel(key: string): string {
  return isQuoteStatus(key) ? QUOTE_STATUS_LABEL[key] : key;
}
