// The page view path rules of the server PageViewRequestValidator (ANL-05, OR-3), by hand so the first download carries no schema
// library. tests/fixtures/page-view-path-cases.json ties both sides to the same cases.

/** The longest path the server takes, in UTF-16 code units (AnalyticsPath.MaxLength). */
export const PAGE_VIEW_PATH_MAX_LENGTH = 2048;

/** Whether the server would take `path`: not empty, starts with a slash, at most the limit long. */
export function isPageViewPath(path: string): boolean {
  return path.startsWith('/') && path.length <= PAGE_VIEW_PATH_MAX_LENGTH;
}
