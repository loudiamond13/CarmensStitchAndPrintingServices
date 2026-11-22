/** A path without its trailing slashes, as the router matches it; the root path `/` stays. */
export function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}
