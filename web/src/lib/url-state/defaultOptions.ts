// One set of nuqs defaults for every list (WEB-10). `shallow: true` is the nuqs default and is never turned off
// (nuqs #1563); defaults stay out of the URL; a URL update never scrolls the page.
export const URL_STATE_DEFAULTS = { shallow: true, clearOnDefault: true, scroll: false } as const;

// RED placeholder (02-08 Task 2): keeps whatever order the keys came in; replaced in GREEN.
export function orderSearchParams(search: URLSearchParams): URLSearchParams {
  return search;
}
