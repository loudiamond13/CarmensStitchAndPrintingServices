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

// SPEC-GAP: quote request page copy (UI-SPEC R2 and Copywriting "R2 head" to "Not found").
export const QUOTE_REQUEST_COPY = {
  /** Shown as "Quote Request · CSPS Admin": the visitor's name never reaches the title (CWE-598). */
  documentTitle: 'Quote Request',
  /** The loading noun: "Loading the quote request…". */
  loadingThing: 'the quote request',
  back: 'Quote Requests',
  received: (when: string): string => `Received ${when} from the website`,
  details: {
    title: 'Request',
    team: 'Team / organization',
    phone: 'Contact number',
    email: 'Email',
    product: 'Product type',
    quantity: 'Quantity (estimate)',
    message: 'Message',
  },
  photos: {
    title: 'Photos',
    /** The name of the tile list and the viewer. */
    listName: 'Request photos',
    /** After the count chip, visually hidden: "3 photos". */
    countHidden: (count: number): string => (count === 1 ? 'photo' : 'photos'),
    /** D-03: the names of the photos that never arrived. */
    missing: (names: readonly string[]): string =>
      `${formatCount(names.length)} ${names.length === 1 ? 'photo' : 'photos'} didn't upload: ${names.join(', ')}. Ask the customer to send them on Messenger.`,
    /** D-04: also after the move back out of Spam, and while the removal job has not run yet. */
    removed: 'The photos were deleted when this request was marked as spam.',
    none: 'No photos were sent.',
  },
  states: {
    loadFailed: "Couldn't load this quote request.",
    notFound: 'Quote request not found',
    notFoundMessage: 'It may have been deleted or cleaned up after 6 months.',
    backToList: 'Back to Quote Requests',
  },
  history: {
    title: 'History',
    separator: ' · ',
    received: 'Received from the website',
    /** Followed by the order number as a link: "Converted to order ORD-2026-0160". */
    convertedTo: 'Converted to order',
  },
  status: {
    menu: 'Change Status',
    /** The button while a move runs, as OrderStatusMenu. */
    saving: 'Saving',
    moveTo: (label: string): string => `Move to ${label}`,
    moved: { title: 'Status changed', message: (label: string): string => `This request is now ${label}.` },
    failed: "Couldn't change the status",
  },
  /** The D-04 confirm before a Spam move deletes photos. */
  spam: {
    title: 'Mark this request as spam?',
    message: (photos: number): string =>
      `Its ${formatCount(photos)} ${photos === 1 ? 'photo' : 'photos'} will be deleted within a day and can't be brought back. The request text stays until it's cleaned up after 6 months.`,
    confirm: 'Mark as Spam',
    pending: 'Marking',
    cancel: 'Cancel',
  },
  /** Turn into Order (D-20) and, once Converted, the way to its order (D-21). */
  convert: {
    action: 'Turn into Order',
    openOrder: (number: string): string => `Open Order ${number}`,
  },
  /** The order page's row for an order made from a request (D-21); the deleted view shows `made` without the link. */
  orderLink: {
    term: 'From quote request',
    viewRequest: 'View Request',
    made: 'Yes',
  },
  /** The ConflictBanner lines after a 409. */
  conflict: { title: 'Someone else changed this request.', body: 'Load the latest to see it.' },
  /** The Manager's Delete Request and its confirm (D-16). */
  remove: {
    action: 'Delete Request',
    locked: "A request that became an order can't be deleted.",
    title: 'Delete this quote request?',
    message: (name: string): string =>
      `This deletes the request from ${name} and its photos for good. This can't be undone.`,
    confirm: 'Delete Request',
    pending: 'Deleting',
    cancel: 'Cancel',
    deleted: 'Quote request deleted',
  },
  /** The add-only Notes card (D-17). */
  notes: {
    title: 'Internal notes',
    hint: "Only staff see these. A note can't be changed or removed after it's added.",
    label: 'Add a note',
    add: 'Add Note',
    adding: 'Adding',
    added: 'Note added.',
    empty: 'No notes yet.',
    failed: "Couldn't add the note",
    /** The server's own words (QuoteRequestRules), so the browser and the server say the same (OR-3). */
    errors: {
      required: 'Write a note first.',
      tooLong: 'Keep the note to 1,000 characters or fewer.',
    },
  },
} as const;
