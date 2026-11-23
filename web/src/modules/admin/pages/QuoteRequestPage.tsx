// SPEC-GAP: quote request page (UI-SPEC R2; INQ-05, D-13, D-36). /admin/quote-requests/:id for both roles: the back link, the
// visitor's name, when it arrived, the status badge, then the Request and Photos cards beside the History card. The document
// title is fixed, so the name stays out of browser history and tab lists (CWE-598).
import clsx from 'clsx';
import { useEffect, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, pageHeadClasses, pageHeadTitleClasses } from '@/components/layout/layout.recipe';
import { LoadingRegion } from '@/components/states';
import {
  orderBackRowClasses,
  orderPageClasses,
  orderSublineClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { QuoteHistoryCard } from '@/modules/admin/components/QuoteHistoryCard';
import { QuoteRequestDetailsCard } from '@/modules/admin/components/QuoteRequestDetailsCard';
import { QuoteRequestPhotosCard } from '@/modules/admin/components/QuoteRequestPhotosCard';
import { QuoteStatusBadge } from '@/modules/admin/components/QuoteRequestsTable';
import {
  quoteColumnClasses,
  quoteDetailClasses,
  quoteNameClasses,
  quoteReceivedRowClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useQuoteRequestQuery } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { quoteBackTarget } from '@/modules/admin/quoteRequestNavigation';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import type { QuoteRequestDetailResponse } from '@/modules/admin/services/quoteRequestsService';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = QUOTE_REQUEST_COPY;

/** A plain left click, which the page may turn into a history step. */
function plainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function BackLink() {
  const location = useLocation();
  const navigate = useNavigate();
  const back = quoteBackTarget(location.state);
  return (
    <div className={orderBackRowClasses}>
      <UiLink
        to={back.to}
        className={clsx(loginBackClasses, hitAreaClasses)}
        onClick={(event) => {
          if (back.historyBack && plainClick(event)) {
            event.preventDefault();
            void navigate(-1);
          }
        }}
      >
        <Icon name="chevron-left" size={16} />
        {COPY.back}
      </UiLink>
    </div>
  );
}

function QuoteRequestBody({ request }: { request: QuoteRequestDetailResponse }) {
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <BackLink />
          <h1 tabIndex={-1} className={quoteNameClasses}>
            {request.customerName}
          </h1>
          <div className={quoteReceivedRowClasses}>
            <p className={orderSublineClasses}>
              {COPY.received(formatBusinessDateTime(request.receivedAtUtc) ?? request.receivedAtUtc)}
            </p>
            <QuoteStatusBadge status={request.status} />
          </div>
        </div>
      </div>
      <div className={quoteDetailClasses}>
        <div className={quoteColumnClasses}>
          <QuoteRequestDetailsCard request={request} />
          <QuoteRequestPhotosCard request={request} />
        </div>
        <div className={quoteColumnClasses}>
          <QuoteHistoryCard history={request.history} />
        </div>
      </div>
    </>
  );
}

export default function QuoteRequestPage() {
  const { id = '' } = useParams();
  const query = useQuoteRequestQuery(id);
  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);
  const request = query.data;
  return (
    <div className={orderPageClasses}>
      <LoadingRegion loading={request === undefined} things={COPY.loadingThing}>
        {request !== undefined && <QuoteRequestBody request={request} />}
      </LoadingRegion>
    </div>
  );
}
