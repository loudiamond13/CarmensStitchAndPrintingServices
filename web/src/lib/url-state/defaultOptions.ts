// One nuqs configuration for every list (WEB-10), used by UrlStateLayout (and by tests through the testing adapter).

/**
 * `shallow: true` is the nuqs default and is never turned off (nuqs #1563); defaults stay out of the URL; a URL update
 * never scrolls the page.
 */
export const URL_STATE_DEFAULTS = { shallow: true, clearOnDefault: true, scroll: false } as const;

/** The keys every list shares, written first and in this order. */
const LEADING_KEYS: readonly string[] = ['page', 'size', 'q'];

function rank(key: string): number {
  const index = LEADING_KEYS.indexOf(key);
  return index === -1 ? LEADING_KEYS.length : index;
}

/**
 * Puts the keys of every URL nuqs writes in one fixed order: page, size, q, then the other keys by name (code-unit
 * order). Equal values therefore always give the same query string, whatever order a link arrived in. The sort is
 * stable, so repeated keys keep their relative order.
 */
export function orderSearchParams(search: URLSearchParams): URLSearchParams {
  const entries = [...search.entries()];
  entries.sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  return new URLSearchParams(entries);
}
