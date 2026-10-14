// SPEC-GAP: list toolkit copy (UI-SPEC "Copywriting Contract": empty states, Pagination, Result bar / filter chip; App.
// E.7/E.8). The plain-English strings of the list primitives, in one module, so the owner can change them in one place
// and no JSX carries its own wording. `things` is the plural noun of the list ("orders"), `thing` the singular. The
// "Walk-in customer" line is the shared WALK_IN_CUSTOMER from `@/components/data` (D-40), never typed here.

/** The singular noun for exactly one, the plural for anything else (zero-one-many: "1 order", "12 orders"). */
export function nounFor(count: number, thing: string, things: string): string {
  return count === 1 ? thing : things;
}

/** The copy of the list primitives (plan 02-30). */
export const LISTS_COPY = {
  /** The visually hidden actions column header (App. E.7/E.12). */
  actions: 'Actions',
  /** First-use empty state: "No orders yet" (App. E.8). */
  emptyTitle: (things: string): string => `No ${things} yet`,
  noMatchesTitle: 'No matches',
  /**
   * "No orders match “Ballers” with status Ready. Try another search or clear the filters." (App. E.8). With filters but
   * no search text: "No orders with status Ready. …", or "No orders match the filters. …" with no summary.
   */
  noMatchesBody: (things: string, search?: string | null, filterSummary?: string): string => {
    const q = search?.trim() ?? '';
    const summary = filterSummary?.trim() ?? '';
    let lead = `No ${things} match the filters.`;
    if (q !== '') {
      lead = summary === '' ? `No ${things} match “${q}”.` : `No ${things} match “${q}” with ${summary}.`;
    } else if (summary !== '') {
      lead = `No ${things} with ${summary}.`;
    }
    return `${lead} Try another search or clear the filters.`;
  },
  clearFilters: 'Clear Filters',
  /** The SearchBox label (App. E.7). */
  search: 'Search',
  /** The result bar: "Showing **12** orders · sorted by due date" (App. E.7). */
  showing: 'Showing',
  sortedBy: (sort: string): string => ` · sorted by ${sort}`,
  /** The filter chip: "Status: Active + recent". */
  chip: (filter: string, value: string): string => `${filter}: ${value}`,
  /** The chip's clear button: "Clear status filter". */
  clearFilter: (filter: string): string => `Clear ${filter.toLowerCase()} filter`,
  /** Pagination (SPEC-GAP). "Page {p} of {n}" is built from `page` and `of` around the two numbers. */
  pagination: {
    label: 'Pagination',
    previous: 'Previous',
    next: 'Next',
    /** The accessible names, kept when the phone layout shows the icons only. */
    previousPage: 'Previous page',
    nextPage: 'Next page',
    page: 'Page',
    of: 'of',
    rowsPerPage: 'Rows per page',
  },
} as const;
