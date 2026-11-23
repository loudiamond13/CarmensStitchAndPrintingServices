// Where the request page's back link goes (UI-SPEC R2 item 1). The inbox sends its own address in the navigation state; only a
// literal inbox path is followed, so a crafted state cannot send anyone elsewhere (CWE-601).
import { safeReturnUrl } from '@/modules/admin/guard';

export const QUOTE_REQUESTS_PATH = '/admin/quote-requests';

export interface QuoteBackTarget {
  /** The inbox address with its filters, or the plain inbox. */
  readonly to: string;
  /** True when the inbox is the previous history entry, so Back can go back in history. */
  readonly historyBack: boolean;
}

export function quoteBackTarget(state: unknown): QuoteBackTarget {
  if (typeof state !== 'object' || state === null || !('from' in state) || typeof state.from !== 'string') {
    return { to: QUOTE_REQUESTS_PATH, historyBack: false };
  }
  const from = safeReturnUrl(state.from);
  const path = from.split(/[?#]/)[0] ?? '';
  return path === QUOTE_REQUESTS_PATH
    ? { to: from, historyBack: true }
    : { to: QUOTE_REQUESTS_PATH, historyBack: false };
}
