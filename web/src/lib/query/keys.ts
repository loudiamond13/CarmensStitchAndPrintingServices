// TanStack Query key builders (WEB-08). A key holds parsed, defaulted values, never raw strings or location.search.
// TanStack hashes object keys in sorted property order, so equal params always share one cache entry.

/** The key of one list query: `[resource, 'list', params]`. */
export function listKey<const R extends string, const P extends object>(resource: R, params: P): readonly [R, 'list', P] {
  return [resource, 'list', params] as const;
}
