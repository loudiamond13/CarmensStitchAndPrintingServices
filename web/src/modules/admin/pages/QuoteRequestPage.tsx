// SPEC-GAP: quote request page (UI-SPEC R2; INQ-05, D-13, D-15, D-36). /admin/quote-requests/:id for both roles: the back link,
// the visitor's name, when it arrived, the status badge and Change Status, then the Request and Photos cards beside the History
// card. The document title is fixed, so the name stays out of browser history and tab lists (CWE-598). A status change answers
// only the new status and version, so the page reads the request again for its history.
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, pageHeadClasses, pageHeadTitleClasses } from '@/components/layout/layout.recipe';
import { ConflictBanner, LoadingRegion } from '@/components/states';
import {
  orderBackRowClasses,
  orderPageClasses,
  orderSublineClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { QuoteHistoryCard } from '@/modules/admin/components/QuoteHistoryCard';
import { QuoteRequestDetailsCard } from '@/modules/admin/components/QuoteRequestDetailsCard';
import { QuoteRequestPhotosCard } from '@/modules/admin/components/QuoteRequestPhotosCard';
import { QuoteStatusBadge } from '@/modules/admin/components/QuoteRequestsTable';
import { QuoteStatusMenu } from '@/modules/admin/components/QuoteStatusMenu';
import {
  quoteActionsClasses,
  quoteColumnClasses,
  quoteDetailClasses,
  quoteNameClasses,
  quoteReceivedRowClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { quoteRequestKey, useQuoteRequestQuery } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { quoteRequestsKey } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { quoteBackTarget } from '@/modules/admin/quoteRequestNavigation';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import type {
  QuoteRequestDetailResponse,
  QuoteRequestStatusChanged,
} from '@/modules/admin/services/quoteRequestsService';
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

interface QuoteRequestBodyProps {
  request: QuoteRequestDetailResponse;
  onMoved: (answer: QuoteRequestStatusChanged) => void;
  onConflict: () => void;
}

function QuoteRequestBody({ request, onMoved, onConflict }: QuoteRequestBodyProps) {
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
        {request.status !== 'converted' && (
          <div className={quoteActionsClasses}>
            <QuoteStatusMenu request={request} onMoved={onMoved} onConflict={onConflict} />
          </div>
        )}
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
  const queryClient = useQueryClient();
  // Each 409 shows the banner again (a new key), so it is announced and takes focus.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const focusHeading = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);
  useEffect(() => {
    if (focusHeading.current && conflicts === 0) {
      focusHeading.current = false;
      rootRef.current?.querySelector<HTMLElement>('h1')?.focus();
    }
  });

  const onMoved = (answer: QuoteRequestStatusChanged): void => {
    // The badge follows at once; the read below brings the history and who changed it.
    queryClient.setQueryData<QuoteRequestDetailResponse>(quoteRequestKey(id), (held) =>
      held === undefined
        ? held
        : { ...held, status: answer.status, statusChangedAtUtc: answer.statusChangedAtUtc, version: answer.version },
    );
    // The prefix covers this request, the inbox lists and NEW_QUOTE_COUNT_KEY, so the nav count updates at once (D-14).
    void queryClient.invalidateQueries({ queryKey: quoteRequestsKey });
  };

  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await query.refetch();
    setLoadingLatest(false);
    if (!result.isError) {
      focusHeading.current = true;
      setConflicts(0);
    }
  };

  const request = query.data;
  return (
    <div ref={rootRef} className={orderPageClasses}>
      {conflicts > 0 && (
        <ConflictBanner
          key={conflicts}
          title={COPY.conflict.title}
          body={COPY.conflict.body}
          pending={loadingLatest}
          onLoadLatest={() => {
            void loadLatest();
          }}
        />
      )}
      <LoadingRegion loading={request === undefined} things={COPY.loadingThing}>
        {request !== undefined && (
          <QuoteRequestBody
            request={request}
            onMoved={onMoved}
            onConflict={() => {
              setConflicts((count) => count + 1);
            }}
          />
        )}
      </LoadingRegion>
    </div>
  );
}
