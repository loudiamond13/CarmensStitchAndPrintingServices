// RED placeholder (plan 02-11): inert options so the tests compile and fail on assertions.
export const URL_STATE_DEFAULTS = { shallow: true, clearOnDefault: false, scroll: true } as const;

export function orderSearchParams(search: URLSearchParams): URLSearchParams {
  return search;
}
