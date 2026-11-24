// SPEC-GAP: quote request page (UI-SPEC R2; INQ-05, D-13, D-15, D-16, D-17, D-36). /admin/quote-requests/:id for both roles: the
// back link, the visitor's name, when it arrived, the status badge, Change Status and, for a Manager, Delete Request, then the
// Request and Photos cards beside the Notes and History cards. The document title is fixed, so the name stays out of browser history and tab lists (CWE-598). A status change
// and a note answer only the new version (and status), so the page reads the request again for its history and notes. The first
// load shows skeletons, a failed load an ErrorState with Try Again, and a gone request or an address that is not a request id the
// not-found state.
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton, useToast } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
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
import { QuoteNotesCard } from '@/modules/admin/components/QuoteNotesCard';
import { QuoteRequestDetailsCard } from '@/modules/admin/components/QuoteRequestDetailsCard';
import { QuoteRequestPhotosCard } from '@/modules/admin/components/QuoteRequestPhotosCard';
import { QuoteStatusBadge } from '@/modules/admin/components/QuoteRequestsTable';
import { QuoteStatusMenu } from '@/modules/admin/components/QuoteStatusMenu';
import {
  quoteActionsClasses,
  quoteColumnClasses,
  quoteDeleteClasses,
  quoteDetailClasses,
  quoteMutedClasses,
  quoteNameClasses,
  quoteReceivedRowClasses,
  quoteTopClasses,
} from '@/modules/admin/components/quoteRequests.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { isQuoteRequestId, quoteRequestKey, useQuoteRequestQuery } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { quoteRequestsKey } from '@/modules/admin/hooks/useQuoteRequestsQuery';
import { useSession } from '@/modules/admin/hooks/useSession';
import { INBOX_HEADING_FOCUS, QUOTE_REQUESTS_PATH, quoteBackTarget } from '@/modules/admin/quoteRequestNavigation';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import {
  quoteRequestsService,
  type QuoteRequestDetailResponse,
  type QuoteRequestNoteAdded,
  type QuoteRequestStatusChanged,
} from '@/modules/admin/services/quoteRequestsService';
import { describeHttpError } from '@/utils/describeHttpError';
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

function isStatus(error: unknown, status: number): boolean {
  return isHttpError(error) && error.kind === 'http' && error.status === status;
}

/** The server's sentence of a refusal, when it sent one. */
function refusal(error: unknown): string | undefined {
  return isStatus(error, 400) && isHttpError(error) ? error.problem?.detail : undefined;
}

interface DeleteRequestProps {
  request: QuoteRequestDetailResponse;
  onConflict: () => void;
}

/**
 * The Manager's Delete Request (D-16): a confirm naming the visitor, then the DELETE with the version. A Converted request keeps the
 * button, aria-disabled and described by why. The DELETE has no Idempotency-Key, so a 404 after this page's own delete means it is
 * already gone: the same toast and way back as a 204. A 409 closes the confirm and the page shows its ConflictBanner. A 400
 * converted-locked keeps the server's sentence in the confirm and reads the request again.
 */
function DeleteRequest({ request, onConflict }: DeleteRequestProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const focusAfterClose = useRef(false);
  const conflictAfterClose = useRef(false);
  const deleted = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const locked = request.status === 'converted';
  const id = request.id;

  // Once the confirm has closed, a 409 raises the banner, else the button takes focus back.
  useEffect(() => {
    if (open) return;
    if (conflictAfterClose.current) {
      conflictAfterClose.current = false;
      onConflict();
    } else if (focusAfterClose.current) {
      focusAfterClose.current = false;
      buttonRef.current?.focus();
    }
  });

  // The deleted request leaves the cache only once the page is gone, so nothing reads it again.
  useEffect(
    () => () => {
      if (deleted.current) queryClient.removeQueries({ queryKey: quoteRequestKey(id), exact: true });
    },
    [queryClient, id],
  );

  const leave = (): void => {
    deleted.current = true;
    toast.show({ tone: 'success', title: COPY.remove.deleted });
    // The inbox lists and the New count read again; the deleted request itself is never read again.
    void queryClient.cancelQueries({ queryKey: quoteRequestKey(id), exact: true });
    void queryClient.invalidateQueries({
      queryKey: quoteRequestsKey,
      predicate: (query) => query.queryKey[1] !== 'detail' || query.queryKey[2] !== id,
    });
    void navigate(quoteBackTarget(location.state).to, { replace: true, state: INBOX_HEADING_FOCUS });
  };

  const confirm = async (): Promise<unknown> => {
    try {
      await quoteRequestsService.remove(id, request.version);
    } catch (error: unknown) {
      if (isStatus(error, 409)) {
        conflictAfterClose.current = true;
        setOpen(false);
        return undefined;
      }
      if (isHttpError(error) && error.code === 'quote-requests.converted-locked') {
        // Someone turned it into an order meanwhile: read it again so the page shows Converted.
        void queryClient.invalidateQueries({ queryKey: quoteRequestKey(id), exact: true });
      }
      if (!isStatus(error, 404)) return { ok: false, error };
    }
    leave();
    return undefined;
  };

  return (
    <div className={quoteDeleteClasses}>
      <Button
        ref={buttonRef}
        variant="ghost-danger"
        icon="trash-2"
        {...(locked ? { 'aria-disabled': true, 'aria-describedby': reasonId } : {})}
        onClick={() => {
          if (!locked) setOpen(true);
        }}
      >
        {COPY.remove.action}
      </Button>
      {locked && (
        <p id={reasonId} className={quoteMutedClasses}>
          {COPY.remove.locked}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={COPY.remove.title}
        message={COPY.remove.message(request.customerName)}
        cancelLabel={COPY.remove.cancel}
        confirmLabel={COPY.remove.confirm}
        pendingLabel={COPY.remove.pending}
        describeFailure={refusal}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          focusAfterClose.current = true;
        }}
      />
    </div>
  );
}

interface QuoteRequestBodyProps {
  request: QuoteRequestDetailResponse;
  onMoved: (answer: QuoteRequestStatusChanged) => void;
  onNoteAdded: (answer: QuoteRequestNoteAdded) => void;
  onConflict: () => void;
}

function QuoteRequestBody({ request, onMoved, onNoteAdded, onConflict }: QuoteRequestBodyProps) {
  const { user } = useSession();
  // Hiding the button is not the control: the server's Manager policy decides (T-13-62).
  const isManager = user?.role === 'manager';
  const showMenu = request.status !== 'converted';
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
        {(showMenu || isManager) && (
          <div className={quoteActionsClasses}>
            {showMenu && <QuoteStatusMenu request={request} onMoved={onMoved} onConflict={onConflict} />}
            {isManager && <DeleteRequest request={request} onConflict={onConflict} />}
          </div>
        )}
      </div>
      <div className={quoteDetailClasses}>
        <div className={quoteColumnClasses}>
          <QuoteRequestDetailsCard request={request} />
          <QuoteRequestPhotosCard request={request} />
        </div>
        <div className={quoteColumnClasses}>
          <QuoteNotesCard request={request} onAdded={onNoteAdded} onConflict={onConflict} />
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
function QuoteRequestNotFound({ focus }: { focus: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) headingRef.current?.focus();
  }, [focus]);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
            {COPY.states.notFound}
          </h1>
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
  const toast = useToast();
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

  const onNoteAdded = (answer: QuoteRequestNoteAdded): void => {
    // The next change sends the new version at once; the read below brings the note itself.
    queryClient.setQueryData<QuoteRequestDetailResponse>(quoteRequestKey(id), (held) =>
      held === undefined ? held : { ...held, version: answer.version },
    );
    void queryClient.invalidateQueries({ queryKey: quoteRequestsKey });
  };

  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await query.refetch();
    setLoadingLatest(false);
    if (result.isError) {
      if (isHttpError(result.error) && result.error.status === 404) {
        // Gone: the page drops it and shows the not-found state, which takes focus.
        void queryClient.resetQueries({ queryKey: quoteRequestKey(id) });
        return;
      }
      const copy = describeHttpError(result.error);
      if (copy !== null) toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      return;
    }
    focusHeading.current = true;
    setConflicts(0);
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
  // Not found that replaces a loading or loaded page takes focus, so it is announced and focus is not lost.
  const [hadPage, setHadPage] = useState(false);
  if (!notFound && !hadPage) {
    setHadPage(true);
  }
  if (notFound) {
    return (
      <div className={orderPageClasses}>
        <QuoteRequestNotFound focus={hadPage} />
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
              onNoteAdded={onNoteAdded}
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
