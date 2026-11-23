// SPEC-GAP: quote requests inbox
// R1 Quote Requests, /admin/quote-requests (INQ-05, D-13, D-18; plan 13-15). Both roles. The open requests (New, Contacted and
// Quoted) newest first, in a ResponsiveTable with Pagination. Status, search, page and size live in the URL through
// useQuoteRequestsListParams (WEB-10). The document title never holds a name (T-13-44).
import { useEffect } from 'react';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { Pagination } from '@/components/lists';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { usePagedList } from '@/lib/url-state/usePagedList';
import { QuoteRequestsTable } from '@/modules/admin/components/QuoteRequestsTable';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useQuoteRequestsListParams } from '@/modules/admin/hooks/useQuoteRequestsListParams';
import { useQuoteRequestsQuery } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';

const COPY = QUOTE_REQUESTS_COPY;
/** The table caption Pagination moves focus to. */
const RESULTS_ID = 'quote-requests-results';

export default function QuoteRequestsPage() {
  const [values, set] = useQuoteRequestsListParams();
  const settled = useSettledListParams(values, 300);
  const query = useQuoteRequestsQuery({
    status: settled.status,
    q: settled.q,
    page: settled.page,
    size: settled.size,
  });

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const total = Number(data?.total ?? 0);
  const { pastTheEnd, pageCount, showPager } = usePagedList(query, total, values.size, set.clampPage);

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <QuoteRequestsTable
        rows={data?.items}
        captionId={RESULTS_ID}
        pending={query.isPending || pastTheEnd}
        refetching={query.isPlaceholderData && query.isFetching}
      />
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
    </>
  );
}
