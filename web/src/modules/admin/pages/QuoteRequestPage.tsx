// SPEC-GAP: quote request page (UI-SPEC R2; INQ-05, D-13, D-15, D-36). /admin/quote-requests/:id for both roles: the back link,
// the visitor's name, when it arrived, the status badge and Change Status, then the Request and Photos cards beside the History
// card. The document title is fixed, so the name stays out of browser history and tab lists (CWE-598). A status change answers
// only the new status and version, so the page reads the request again for its history. The first load shows skeletons, a failed
// load an ErrorState with Try Again, and a gone request or an address that is not a request id the not-found state.
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ConflictBanner, ErrorState, LoadingRegion, SkeletonText, STATES_COPY } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import {
  orderBackRowClasses,
  orderCardBodyClasses,
  orderCardClasses,
  orderPageClasses,
  orderStateActionClasses,
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
  quoteTopClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { isQuoteRequestId, quoteRequestKey, useQuoteRequestQuery } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { quoteRequestsKey } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { QUOTE_REQUESTS_PATH, quoteBackTarget } from '@/modules/admin/quoteRequestNavigation';
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

/** The first-load placeholder: the h1 as a line, then three text lines in each card, where the real ones land. */
function QuoteRequestSkeleton() {
  return (
    <>
      <div className={pageHeadTitleClasses} aria-hidden="true">
        <Skeleton width={240} height={34} />
        <Skeleton width={280} height={14} />
      </div>
      <div className={quoteDetailClasses} aria-hidden="true">
        <div className={quoteColumnClasses}>
          {[0, 1].map((card) => (
            <div key={card} className={orderCardClasses}>
              <div className={orderCardBodyClasses}>
                <SkeletonText lines={3} />
              </div>
            </div>
          ))}
        </div>
        <div className={quoteColumnClasses}>
          <div className={orderCardClasses}>
            <div className={orderCardBodyClasses}>
              <SkeletonText lines={3} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** A request that is gone (deleted or purged) or an address that is not a request id. */
function QuoteRequestNotFound() {
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{COPY.states.notFound}</h1>
          <p className={pageSublineClasses}>{COPY.states.notFoundMessage}</p>
        </div>
      </div>
      <div className={orderStateActionClasses}>
        <ButtonLink variant="secondary" to={QUOTE_REQUESTS_PATH}>
          {COPY.states.backToList}
        </ButtonLink>
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

  const validId = isQuoteRequestId(id);
  const request = query.data;
  // With no data, a read again sets the query back to pending and clears its error, so the last error is kept and a failure
  // counts until a read succeeds. The alert and Try Again then stay in place while it reads (13-REVIEW-FIX-W7 WR-01).
  const [heldError, setHeldError] = useState<unknown>(null);
  if (query.error !== null && query.error !== heldError) {
    setHeldError(query.error);
  }
  const lastError = query.error ?? heldError;
  const failed = validId && request === undefined && (query.isError || query.errorUpdatedAt > query.dataUpdatedAt);
  const notFound = !validId || (failed && isHttpError(lastError) && lastError.status === 404);
  const loading = validId && request === undefined && !failed;
  if (notFound) {
    return (
      <div className={orderPageClasses}>
        <QuoteRequestNotFound />
      </div>
    );
  }
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
      {/* One back link for every state, so it shows at once and keeps focus when the request arrives. */}
      <div className={quoteTopClasses}>
        <BackLink />
        {failed && (
          <ErrorState
            align="start"
            title={COPY.states.loadFailed}
            message={STATES_COPY.error.loadFailedBody}
            error={lastError}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )}
        <LoadingRegion loading={loading} failed={failed} things={COPY.loadingThing} className={orderPageClasses}>
          {loading && <QuoteRequestSkeleton />}
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
    </div>
  );
}
