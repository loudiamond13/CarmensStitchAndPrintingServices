// The paging logic every paged list shares (WEB-08, WEB-10): when a page is past the end, when the list is loading or has failed, how
// many pages there are, and the clamp of a stale page to the last one. A list passes its query, its total and the page size from the
// URL; the lists draw their own table and pager from what comes back.
import { useEffect } from 'react';
import { PAGE_SIZES, type PageSize } from './parsers';

/** One page as the server answers it: the money lists call the rows `rows`, the others `items`. */
interface PagedAnswer {
  readonly rows?: readonly unknown[];
  readonly items?: readonly unknown[];
}

/** The parts of a TanStack query result the paging logic reads. */
interface PagedQuery {
  readonly data: PagedAnswer | undefined;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly isPlaceholderData: boolean;
}

export interface PagedListState {
  /** The page has no rows but the list has some: it is about to be replaced by the last page, so it is not an empty list. */
  pastTheEnd: boolean;
  /** Nothing to show yet: the first answer, a retry after a failure, or a page past the end. */
  loading: boolean;
  failed: boolean;
  pageCount: number;
  /** The answer on screen is this page's own, not a kept earlier page. */
  fresh: boolean;
  /** The pager is drawn: more rows than the smallest page size (so Rows per page stays after a size that fits them all), and not on a page past the end. */
  showPager: boolean;
}

/**
 * `total` is the server's count of every row (0 until the first answer), `size` the rows per page, `clampPage` the list hook's
 * clampPage. A page past the last one (a stale link, or rows removed meanwhile) becomes the last page once fresh data says so.
 */
export function usePagedList(
  query: PagedQuery,
  total: number,
  size: PageSize,
  clampPage: (pageCount: number) => void,
): PagedListState {
  const rows = query.data?.rows ?? query.data?.items;
  const pastTheEnd = rows?.length === 0 && total > 0;
  const loading = (query.isFetching && (query.data === undefined || query.isError)) || pastTheEnd;
  const failed = query.isError && !query.isFetching;
  const pageCount = Math.ceil(total / size);

  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  return {
    pastTheEnd,
    loading,
    failed,
    pageCount,
    fresh,
    showPager: total > PAGE_SIZES[0] && !pastTheEnd,
  };
}
