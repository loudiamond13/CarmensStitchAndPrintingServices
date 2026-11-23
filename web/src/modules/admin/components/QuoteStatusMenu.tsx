// SPEC-GAP: quote request Change Status menu (UI-SPEC R2 actions; D-15, D-04). The OrderStatusMenu button and keys with a menu of
// "Move to {Status}" for every status but the current one and Converted, which only turning the request into an order sets. A move
// acts at once with the row version and an Idempotency-Key. Moving to Spam while photos remain asks first, because the photos are
// deleted for good (D-04). A 409 is the page's ConflictBanner; a refusal is a danger toast with the server's sentence.
// Keyboard (WAI-ARIA APG menu button): Enter, Space or a click open on the first item, ArrowDown on the first, ArrowUp on the last;
// in the menu the arrows move with wrap-around, Home and End jump, Esc closes and focuses the button, Tab closes and moves on.
import clsx from 'clsx';
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/actions';
import { rovingItem } from '@/components/choice/roving';
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { usePresence } from '@/hooks/usePresence';
import { useSubmission } from '@/lib/forms/useSubmission';
import {
  orderStatusDotClasses,
  orderStatusDotToneClasses,
  orderStatusIconSlotClasses,
  orderStatusItemClasses,
  orderStatusMenuClasses,
  orderStatusMenuPopoverClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { quoteRequestKey } from '@/modules/admin/hooks/useQuoteRequestQuery';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import { QUOTE_STATUS_TONE, QUOTE_STATUSES, quoteStatusLabel, type QuoteStatus } from '@/modules/admin/quoteStatus';
import {
  quoteRequestsService,
  type QuoteRequestDetailResponse,
  type QuoteRequestStatusChanged,
} from '@/modules/admin/services/quoteRequestsService';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = QUOTE_REQUEST_COPY.status;
export const QUOTE_CHANGE_STATUS_ID = 'quote-change-status';
const CONFLICT = 'quote-requests.conflict';

export interface QuoteStatusMenuProps {
  request: QuoteRequestDetailResponse;
  /** A move succeeded: the page takes the new status and version and reads the request again. */
  onMoved: (answer: QuoteRequestStatusChanged) => void;
  /** Someone else changed the request first (409): the page shows the ConflictBanner. */
  onConflict: () => void;
}

interface Move {
  readonly status: string;
  readonly version: string;
}

type OpenAt = 'first' | 'last';

function isConflict(error: unknown): boolean {
  return isHttpError(error) && error.status === 409 && error.code === CONFLICT;
}

function isGone(error: unknown): boolean {
  return isHttpError(error) && error.kind === 'http' && error.status === 404;
}

/** The server's sentence of a refusal, when it sent one. */
function refusal(error: unknown): string | undefined {
  return isHttpError(error) && error.kind === 'http' && error.status === 400 ? error.problem?.detail : undefined;
}

/** The statuses a person may move to: all but the current one and Converted (D-15). */
function targets(current: string): QuoteStatus[] {
  return QUOTE_STATUSES.filter((status) => status !== current && status !== 'converted');
}

export function QuoteStatusMenu({ request, onMoved, onConflict }: QuoteStatusMenuProps) {
  const [menu, setMenu] = useState<{ open: boolean; at: OpenAt }>({ open: false, at: 'first' });
  const [spamOpen, setSpamOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A move from the Spam confirm shows its failure in the dialog, not in a toast.
  const inDialog = useRef(false);
  const focusAfterDialog = useRef(false);
  const menuId = useId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const presence = usePresence(menu.open);

  const move = useSubmission<Move, QuoteRequestStatusChanged>(
    (key, data) => quoteRequestsService.changeStatus(request.id, data.status, data.version, key),
    {
      onSuccess: (answer) => {
        toast.show({
          tone: 'success',
          title: COPY.moved.title,
          message: COPY.moved.message(quoteStatusLabel(answer.status)),
        });
        onMoved(answer);
      },
      onFailure: (copy: ErrorCopy, error) => {
        if (isConflict(error)) {
          onConflict();
          return;
        }
        if (isGone(error)) {
          // The request was deleted or purged: the page drops it and shows its not-found state.
          void queryClient.resetQueries({ queryKey: quoteRequestKey(request.id) });
          return;
        }
        void queryClient.invalidateQueries({ queryKey: quoteRequestKey(request.id) });
        if (!inDialog.current) {
          toast.show({ tone: 'danger', title: COPY.failed, message: refusal(error) ?? errorLine(copy) });
        }
      },
    },
  );

  const close = (focusButton: boolean): void => {
    setMenu((state) => ({ ...state, open: false }));
    if (focusButton) buttonRef.current?.focus();
  };

  const moveTo = (status: string): void => {
    close(true);
    if (status === 'spam' && request.photos.length > 0) {
      setSpamOpen(true);
      return;
    }
    void move.submit({ status, version: request.version });
  };

  const closeSpam = (): void => {
    setSpamOpen(false);
    focusAfterDialog.current = true;
  };

  const confirmSpam = async (): Promise<unknown> => {
    inDialog.current = true;
    const outcome = await move.submit({ status: 'spam', version: request.version });
    inDialog.current = false;
    if (outcome.ok || isConflict(outcome.error) || isGone(outcome.error)) {
      closeSpam();
      return undefined;
    }
    return outcome;
  };

  // Once the confirm has closed, Change Status takes focus back (the item that opened it is gone).
  useEffect(() => {
    if (focusAfterDialog.current && !spamOpen) {
      focusAfterDialog.current = false;
      buttonRef.current?.focus();
    }
  });

  const onArrow = useEffectEvent((event: globalThis.KeyboardEvent): void => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !move.pending) {
      event.preventDefault();
      setMenu({ open: true, at: event.key === 'ArrowDown' ? 'first' : 'last' });
    }
  });
  useEffect(() => {
    const button = buttonRef.current;
    if (button === null) return undefined;
    const listener = (event: globalThis.KeyboardEvent): void => {
      onArrow(event);
    };
    button.addEventListener('keydown', listener);
    return () => {
      button.removeEventListener('keydown', listener);
    };
  }, []);

  return (
    <div className={orderStatusMenuClasses}>
      <Button
        ref={buttonRef}
        id={QUOTE_CHANGE_STATUS_ID}
        variant="secondary"
        iconRight="chevron-down"
        pending={move.pending}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        {...(menu.open ? { 'aria-controls': menuId } : {})}
        onClick={() => {
          if (menu.open) {
            close(false);
          } else {
            setMenu({ open: true, at: 'first' });
          }
        }}
      >
        {move.pending ? COPY.saving : COPY.menu}
      </Button>
      {presence.mounted && (
        <MenuPopover
          id={menuId}
          open={menu.open}
          openAt={menu.at}
          presenceRef={presence.ref}
          buttonRef={buttonRef}
          statuses={targets(request.status)}
          onClose={close}
          onMove={moveTo}
        />
      )}
      <ConfirmDialog
        open={spamOpen}
        title={QUOTE_REQUEST_COPY.spam.title}
        message={QUOTE_REQUEST_COPY.spam.message(request.photos.length)}
        cancelLabel={QUOTE_REQUEST_COPY.spam.cancel}
        confirmLabel={QUOTE_REQUEST_COPY.spam.confirm}
        pendingLabel={QUOTE_REQUEST_COPY.spam.pending}
        describeFailure={(error) => refusal(error)}
        onConfirm={confirmSpam}
        onCancel={closeSpam}
      />
    </div>
  );
}

interface MenuPopoverProps {
  id: string;
  /** False while the exit animation plays. */
  open: boolean;
  openAt: OpenAt;
  presenceRef: (node: HTMLElement | null) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  statuses: readonly QuoteStatus[];
  onClose: (focusButton: boolean) => void;
  onMove: (status: string) => void;
}

function MenuPopover({ id, open, openAt, presenceRef, buttonRef, statuses, onClose, onMove }: MenuPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(onClose);

  const setNode = (node: HTMLDivElement | null): void => {
    menuRef.current = node;
    presenceRef(node);
  };

  // Focus the first or last item on open; a press outside the menu and its button closes it.
  useEffect(() => {
    const node = menuRef.current;
    if (node === null || !open) return undefined;
    const items = [...node.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    (openAt === 'first' ? items[0] : items.at(-1))?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && !node.contains(target) && buttonRef.current?.contains(target) !== true) {
        requestClose(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, openAt, buttonRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === 'Tab') {
      // No preventDefault: focus goes to the button, and the browser's Tab then moves on from there.
      onClose(true);
      return;
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.findIndex((element) => element === document.activeElement);
    const next = rovingItem(items, index, event.key, 'menu');
    if (next !== undefined) {
      event.preventDefault();
      next.item.focus();
    }
  };

  return (
    <div
      ref={setNode}
      id={id}
      role="menu"
      aria-labelledby={QUOTE_CHANGE_STATUS_ID}
      tabIndex={-1}
      data-state={open ? 'open' : 'closed'}
      inert={open ? undefined : true}
      className={orderStatusMenuPopoverClasses}
      onKeyDown={onKeyDown}
    >
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={orderStatusItemClasses}
          onClick={() => {
            if (open) onMove(status);
          }}
        >
          <span className={orderStatusIconSlotClasses}>
            <span
              className={clsx(orderStatusDotClasses, orderStatusDotToneClasses[QUOTE_STATUS_TONE[status]])}
              aria-hidden="true"
            />
          </span>
          <span>{COPY.moveTo(quoteStatusLabel(status))}</span>
        </button>
      ))}
    </div>
  );
}
