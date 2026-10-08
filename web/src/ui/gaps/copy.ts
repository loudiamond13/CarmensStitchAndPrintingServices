// SPEC-GAP copy (02-UI-SPEC "Copywriting Contract"): the plain-English strings of the primitives the spec does not
// draw, in one module so the owner can change them in one place and no JSX carries its own wording. Plan 12 added the
// form strings; plan 13 the data-primitive strings (lists, loading, errors, Pagination, FilterBar).

/** MoneyInput (ORD-09, SPEC-GAP). */
export const MONEY_INPUT_COPY = {
  prefix: '₱',
  required: 'Enter an amount.',
  invalid: 'Enter an amount like 1250.50 (numbers only, up to 2 decimals).',
} as const;

/** OtpInput (WEB-06, SPEC-GAP). A showcase example: Phase 4 owns the final sign-in copy. */
export const OTP_INPUT_COPY = {
  legend: 'Sign-in code',
  hint: 'Enter the 6-digit code we emailed you.',
  incomplete: 'Enter all 6 digits.',
  digit: (index: number, count: number): string => `Digit ${String(index)} of ${String(count)}`,
} as const;

/** SkipLink (A11Y-02, SPEC-GAP). */
export const SKIP_LINK_COPY = {
  label: 'Skip to main content',
} as const;

// Checkbox (SPEC-GAP) has no copy of its own: the caller passes the label text (for example the spec's
// "Keep me signed in", App. E), so there is nothing to keep here.

/** "users" -> "Users", for the sentence-initial "{Things} loaded." */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The singular noun for exactly one, the plural for anything else (zero-one-many: "1 order", "12 orders"). */
export function nounFor(count: number, thing: string, things: string): string {
  return count === 1 ? thing : things;
}

/** List regions (ResponsiveTable, LoadingRegion; WEB-06, SPEC-GAP). `things` is the plural noun, like "orders". */
export const LIST_COPY = {
  /** A missing cell value (spec section 9.4). */
  missing: '—',
  /** A missing team (spec section 8.3, App. E.7). */
  walkIn: 'Walk-in customer',
  /** The visually hidden action column header (App. E.7). */
  actions: 'Actions',
  emptyTitle: (things: string): string => `No ${things} yet`,
  noMatchesTitle: 'No matches',
  /**
   * "No orders match “Ballers” with status Ready. Try another search or clear the filters." (App. E.8). With filters
   * but no search text: "No orders with status Ready. …", or "No orders match the filters. …" with no summary.
   */
  noMatchesBody: (things: string, search?: string | null, filterSummary?: string): string => {
    const q = search?.trim() ?? '';
    const lead =
      q !== ''
        ? `No ${things} match “${q}”${filterSummary ? ` with ${filterSummary}` : ''}.`
        : filterSummary
          ? `No ${things} with ${filterSummary}.`
          : `No ${things} match the filters.`;
    return `${lead} Try another search or clear the filters.`;
  },
  clearFilters: 'Clear Filters',
  /** LoadingRegion announcements (UI-SPEC Copywriting "Loading announcement"). */
  loading: (things: string): string => `Loading ${things}…`,
  loaded: (things: string): string => `${capitalize(things)} loaded.`,
} as const;

/** ErrorState (App. E.8 "Couldn't load", SPEC-GAP primitive). */
export const ERROR_STATE_COPY = {
  loadFailedTitle: (things: string): string => `Couldn't load ${things}.`,
  loadFailedBody: 'Check your internet connection. Your data is safe — nothing was changed.',
  reference: (traceId: string): string => `Reference: ${traceId}`,
  retry: 'Try Again',
} as const;

/** Pagination (WEB-06, SPEC-GAP). "Page {p} of {n}" is built from `page` and `of` around the two numbers. */
export const PAGINATION_COPY = {
  label: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  /** The accessible names, kept when the phone layout shows the icons only. */
  previousPage: 'Previous page',
  nextPage: 'Next page',
  page: 'Page',
  of: 'of',
  rowsPerPage: 'Rows per page',
} as const;

/** FilterBar, SearchBox, ResultBar and FilterChip (App. E.7). */
export const FILTER_BAR_COPY = {
  search: 'Search',
  showing: 'Showing',
  sortedBy: (sort: string): string => ` · sorted by ${sort}`,
  /** "Status: Active + recent". */
  chip: (filter: string, value: string): string => `${filter}: ${value}`,
  /** "Clear status filter". */
  clearFilter: (filter: string): string => `Clear ${filter.toLowerCase()} filter`,
} as const;
