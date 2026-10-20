// The URL fragment of an emailed link (reset, invite and email change). The token travels in the fragment, so it is never
// part of a request address or a Referer; it is read once and removed from the address bar at once (CWE-598).

/** The token in a fragment like `#token=abc`, or null when there is none. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('token');
  return token === null || token === '' ? null : token;
}

/** Drops the fragment from the address bar without a navigation, keeping the router's history state. */
export function removeFragment(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}
