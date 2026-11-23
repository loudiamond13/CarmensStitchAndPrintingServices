// SPEC-GAP: quote requests inbox
// R1 Quote Requests, /admin/quote-requests (INQ-05, D-13, D-18; plan 13-15). Both roles. The page head, the search, the
// status pills under it, the result bar with the search chip, the table (cards on phones) and Pagination. Status, search, page
// and size live in the URL through useQuoteRequestsListParams (WEB-10).
//   - First load: SkeletonTable with 5 rows in a busy region; the pills show without counts.
//   - Empty: each pill has its own words; a search with no match offers Clear Search.
//   - A failed first load is an ErrorState with Try Again; a failed later refresh keeps the rows and shows the stale line.
//   - The list reads again every 60 seconds and on focus, but not after a failed read. New rows never move focus; a hidden polite line says how many New
//     requests arrived: ids no answer in this visit held, received after the newest one seen. The line clears after 5 seconds and on a view change, so
//     the next arrival changes the text and is read out.
// The document title never holds a name (T-13-44).
import { useEffect, useState } from 'react';
import { Button, hitAreaClasses } from '@/components/actions';
import { EmptyState } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { FilterBar, FilterChip, Pagination, ResultBar, SearchBox } from '@/components/lists';
import { ErrorState } from '@/components/states';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { usePagedList } from '@/lib/url-state/usePagedList';
import { dashboardStaleClasses, dashboardStaleTextClasses } from '@/modules/admin/components/dashboard.recipe';
import { QuoteRequestsTable } from '@/modules/admin/components/QuoteRequestsTable';
import { QuoteStatusFilter } from '@/modules/admin/components/QuoteStatusFilter';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useQuoteRequestsListParams } from '@/modules/admin/hooks/useQuoteRequestsListParams';
import { useQuoteRequestsQuery } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';
import type { QuoteRequestListResponse } from '@/modules/admin/services/quoteRequestsService';
import { formatBusinessTime } from '@/utils/format';

const COPY = QUOTE_REQUESTS_COPY;
/** The table caption Pagination moves focus to. */
const RESULTS_ID = 'quote-requests-results';
/** How long the hidden new-request line stays before it clears. */
const ARRIVED_CLEAR_MS = 5_000;

/** The last answer seen and its view (status, search, page and size), to tell a refresh's new requests from a view change. */
interface Seen {
  readonly view: string;
  readonly data: QuoteRequestListResponse;
  /** Every id any answer in this visit held, in any view. */
  readonly ids: ReadonlySet<string>;
  /** The latest received time any answer in this visit held, in ms. */
  readonly newest: number;
}

/** The New requests in `data` that arrived since `seen`: never seen in this visit and received after the newest seen. */
function arrivals(data: QuoteRequestListResponse, seen: Seen): number {
  return data.items.filter(
    (item) => item.status === 'new' && !seen.ids.has(item.id) && Date.parse(item.receivedAtUtc) > seen.newest,
  ).length;
}

/** `seen` with the answer added. */
function remember(seen: Seen | null, view: string, data: QuoteRequestListResponse): Seen {
  const ids = new Set(seen?.ids);
  let newest = seen?.newest ?? Number.NEGATIVE_INFINITY;
  for (const item of data.items) {
    ids.add(item.id);
    const at = Date.parse(item.receivedAtUtc);
    if (!Number.isNaN(at)) newest = Math.max(newest, at);
  }
  return { view, data, ids, newest };
}

/** The New requests a refresh brought, for the view they arrived in. */
interface Arrived {
  readonly view: string;
  readonly count: number;
}

export default function QuoteRequestsPage() {
  const [values, set] = useQuoteRequestsListParams();
  const settled = useSettledListParams(values, 300);
  const params = { status: settled.status, q: settled.q, page: settled.page, size: settled.size };
  const query = useQuoteRequestsQuery(params);

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const total = Number(data?.total ?? 0);
  const { pastTheEnd, pageCount, showPager } = usePagedList(query, total, values.size, set.clampPage);

  // Adjust during render: a fresh answer for the same view that holds New requests not seen before is news.
  const view = `${params.status}|${params.q ?? ''}|${String(params.page)}|${String(params.size)}`;
  const [seen, setSeen] = useState<Seen | null>(null);
  const [arrived, setArrived] = useState<Arrived | null>(null);
  if (arrived !== null && arrived.view !== view) {
    setArrived(null);
  }
  if (data !== undefined && !query.isPlaceholderData && seen?.data !== data) {
    if (seen !== null && seen.view === view) {
      const added = arrivals(data, seen);
      if (added > 0) {
        // A line still showing adds up, so the text always changes.
        setArrived({ view, count: (arrived?.view === view ? arrived.count : 0) + added });
      }
    }
    setSeen(remember(seen, view, data));
  }

  useEffect(() => {
    if (arrived === null) return;
    const timer = setTimeout(() => {
      setArrived(null);
    }, ARRIVED_CLEAR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [arrived]);

  const rows = data?.items;
  const hasRows = rows !== undefined && rows.length > 0;
  const firstFailed = query.isError && data === undefined;
  // The stale line stays while Try Again reads, so its alert is not read out again and focus stays on the button.
  const staleAt =
    query.isError && data !== undefined ? formatBusinessTime(new Date(query.dataUpdatedAt).toISOString()) : null;
  const empty = query.isSuccess && !hasRows && !pastTheEnd;
  const retry = (): void => {
    void query.refetch();
  };
  const clearSearch = (): void => {
    set.setSearch('', { immediate: true });
  };

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
          {staleAt !== null && (
            <div className={dashboardStaleClasses}>
              <p role="alert" className={dashboardStaleTextClasses}>
                {COPY.stale(staleAt)}
              </p>
              <Button variant="ghost" size="sm" className={hitAreaClasses} pending={query.isFetching} onClick={retry}>
                {COPY.retry}
              </Button>
            </div>
          )}
        </div>
      </div>
      <FilterBar>
        <SearchBox
          value={values.q}
          label={COPY.search.label}
          placeholder={COPY.search.placeholder}
          onSearch={set.setSearch}
        />
      </FilterBar>
      <QuoteStatusFilter
        selected={values.status}
        counts={data?.counts}
        onSelect={(status) => {
          set.setFilter('status', status);
        }}
      />
      <ResultBar count={pastTheEnd ? 0 : total} thing={COPY.thing} things={COPY.things}>
        {values.q !== null && <FilterChip label={COPY.search.chip} value={values.q} onClear={clearSearch} />}
      </ResultBar>
      {firstFailed && <ErrorState things={COPY.loadingThings} align="start" error={query.error} onRetry={retry} />}
      {empty && values.q !== null && (
        <EmptyState
          icon="search"
          title={COPY.empty.searchTitle(values.q)}
          message={COPY.empty.searchMessage}
          action={
            <Button variant="secondary" onClick={clearSearch}>
              {COPY.empty.clearSearch}
            </Button>
          }
        />
      )}
      {empty && values.q === null && (
        <EmptyState
          icon="inbox"
          title={COPY.empty.titles[values.status]}
          message={COPY.empty.messages[values.status]}
        />
      )}
      {!firstFailed && !empty && (
        <QuoteRequestsTable
          rows={rows}
          captionId={RESULTS_ID}
          pending={query.isPending || pastTheEnd}
          refetching={query.isPlaceholderData && query.isFetching}
        />
      )}
      {showPager && (
        <Pagination
          page={values.page}
          pageCount={pageCount}
          onPageChange={set.setPage}
          focusTargetId={RESULTS_ID}
          pageSize={values.size}
          onPageSizeChange={set.setPageSize}
          sizeOnlyWhenSinglePage
        />
      )}
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {arrived === null ? '' : COPY.arrived(arrived.count)}
      </div>
    </>
  );
}
