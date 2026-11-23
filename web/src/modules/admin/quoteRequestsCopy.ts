// SPEC-GAP: quote requests inbox copy (UI-SPEC R1 and Copywriting "Admin (R1 to R5)"). One module, so the owner can change
// the words in one place.
import type { QuoteStatusFilter } from '@/modules/admin/services/quoteRequestsService';
import { formatCount } from '@/utils/format';

export const QUOTE_REQUESTS_COPY = {
  documentTitle: 'Quote Requests',
  title: 'Quote Requests',
  subline: 'Requests sent from the Get a Quote form on the website.',
  /** The result bar nouns: "Showing 1 request", "Showing 4 requests". */
  thing: 'request',
  things: 'requests',
  /** The loading and error noun: "Loading the quote requests…", "Couldn't load the quote requests." */
  loadingThings: 'the quote requests',
  tableCaption: 'Quote requests',
  /** The visually hidden heading Pagination moves focus to. */
  results: 'Quote request results',
  search: { label: 'Search requests', placeholder: 'Name, team or phone', chip: 'Search' },
  columns: {
    received: 'Received',
    name: 'Name',
    phone: 'Phone',
    product: 'Product',
    pieces: 'Pieces',
    photos: 'Photos',
    status: 'Status',
  },
  product: { custom: 'Custom design', notSure: 'Not sure yet' },
  /** "21-50 pcs" */
  pieces: (range: string): string => `${range} pcs`,
  photos: {
    /** "2 of 3", with the hidden "photos arrived" after it. */
    partial: (stored: number, declared: number): string => `${formatCount(stored)} of ${formatCount(declared)}`,
    partialHidden: 'photos arrived',
    removed: 'Removed',
  },
  pills: {
    toolbar: 'Show',
    labels: {
      open: 'Open',
      converted: 'Converted',
      closed: 'Closed',
      spam: 'Spam',
      all: 'All',
    } satisfies Record<QuoteStatusFilter, string>,
    /** After the count, visually hidden: "4 requests". */
    hidden: 'requests',
  },
  empty: {
    titles: {
      open: 'No open quote requests',
      converted: 'No converted requests',
      closed: 'No closed requests',
      spam: 'No spam requests',
      all: 'No quote requests yet',
    } satisfies Record<QuoteStatusFilter, string>,
    messages: {
      open: "New requests from the website's Get a Quote form show here.",
      converted: 'Requests show here when their status changes.',
      closed: 'Requests show here when their status changes.',
      spam: 'Requests show here when their status changes.',
      all: "Requests from the website's Get a Quote form show here.",
    } satisfies Record<QuoteStatusFilter, string>,
    searchTitle: (q: string): string => `No requests match "${q}"`,
    searchMessage: 'Check the spelling, or search by phone number.',
    clearSearch: 'Clear Search',
  },
  /** The P10 D-111 stale line after a failed later refresh, word for word. */
  stale: (time: string): string => `Showing figures from ${time}. Couldn't refresh.`,
  retry: 'Try Again',
  /** The hidden polite line when a refresh brings new requests: "1 new quote request." */
  arrived: (count: number): string => `${formatCount(count)} new ${count === 1 ? 'quote request' : 'quote requests'}.`,
} as const;
