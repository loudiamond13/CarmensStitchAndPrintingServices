// TanStack Query keys (WEB-08). Keys hold parsed, defaulted values, never raw strings or location.search. TanStack
// hashes object keys in sorted order, so equal params always hit the same cache entry.
export const keys = {
  list: <const A extends string, const P extends object>(area: A, params: P) => [area, 'list', params] as const,
  detail: <const A extends string, const I extends string | number>(area: A, id: I) => [area, 'detail', id] as const,
  site: {
    settings: () => ['site', 'settings'] as const,
  },
};
