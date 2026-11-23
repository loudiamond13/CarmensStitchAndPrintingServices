// SPEC-GAP: quote requests inbox
// R1 Quote Requests, /admin/quote-requests (INQ-05, D-13, D-18; plan 13-15). Both roles. The page head, the search, the
// status pills under it, the result bar with the search chip, the table (cards on phones) and Pagination. Status, search, page
// and size live in the URL through useQuoteRequestsListParams (WEB-10).
//   - First load: SkeletonTable with 5 rows in a busy region; the pills show without counts.
//   - Empty: each pill has its own words; a search with no match offers Clear Search.
//   - A failed first load is an ErrorState with Try Again; a failed later refresh keeps the rows and shows the stale line.
//   - The list reads again every 60 seconds and on focus. New rows never move focus; a hidden polite line says how many New
//     requests arrived since the last answer for the same view.
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

/** The ids of the New requests in an answer. */
function newIds(data: QuoteRequestListResponse): readonly string[] {
  return data.items.filter((item) => item.status === 'new').map((item) => item.id);
}

/** The last answer seen for one view (status, search, page and size), to tell a refresh's new requests from a view change. */
interface Seen {
  readonly view: string;
  readonly data: QuoteRequestListResponse;
  readonly ids: readonly string[];
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

  // Adjust during render: a fresh answer for the same view that holds New requests the last one did not is news.
  const view = `${params.status}|${params.q ?? ''}|${String(params.page)}|${String(params.size)}`;
  const [seen, setSeen] = useState<Seen | null>(null);
  const [arrived, setArrived] = useState('');
  if (data !== undefined && !query.isPlaceholderData && seen?.data !== data) {
    const ids = newIds(data);
    if (seen !== null && seen.view === view) {
      const added = ids.filter((id) => !seen.ids.includes(id)).length;
      if (added > 0) {
        setArrived(COPY.arrived(added));
      }
    }
    setSeen({ view, data, ids });
  }

  const rows = data?.items;
  const hasRows = rows !== undefined && rows.length > 0;
  const firstFailed = query.isError && data === undefined;
  const staleAt =
    query.isError && data !== undefined && !query.isFetching
      ? formatBusinessTime(new Date(query.dataUpdatedAt).toISOString())
      : null;
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
              <Button variant="ghost" size="sm" className={hitAreaClasses} onClick={retry}>
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
        {arrived}
      </div>
    </>
  );
}
