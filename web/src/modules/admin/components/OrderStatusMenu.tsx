// The Change Status menu button (ORD-07, D-14, D-20, D-47; UI-SPEC O1 OrderStatusMenu; plan 08-19). It sits by the status badge on an
// active order and lists "Move to {Status}" for every other active status, then Mark Completed (aria-disabled with its reason
// unless the balance is exactly 0.00 and no credit is held) and Cancel Order. A move acts at once, with an Idempotency-Key and no
// version (05 D-21): the page takes the answer as it is. The menu decides from orderRules only; the server still decides, and a
// refusal is a danger toast with the server's sentence.
// Keyboard (WAI-ARIA APG menu button, the same rules as the user menu):
//   - the button: Enter, Space or a click open the menu on its first item, ArrowDown on the first, ArrowUp on the last;
//   - in the menu: ArrowDown and ArrowUp move with wrap-around, Home and End jump; Esc closes it and focuses the button; Tab
//     closes it and moves on from the button; choosing an item closes it and focuses the button; a press outside closes it.
// The disabled Mark Completed item stays in the arrow order, so a keyboard user hears why it is unavailable.
import clsx from 'clsx';
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { rovingItem } from '@/components/choice/roving';
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { usePresence } from '@/hooks/usePresence';
import { CancelOrderDialog } from '@/modules/admin/components/CancelOrderDialog';
import { OrderStatusDot } from '@/modules/admin/components/OrderStatusDot';
import {
  orderStatusDangerItemClasses,
  orderStatusDividerClasses,
  orderStatusIconSlotClasses,
  orderStatusItemClasses,
  orderStatusItemTextClasses,
  orderStatusMenuClasses,
  orderStatusMenuPopoverClasses,
  orderStatusReasonClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canComplete } from '@/modules/admin/orderRules';
import { CHANGE_STATUS_ID, orderStatusLabel, otherActiveStatuses } from '@/modules/admin/orderStatus';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';

const COPY = ORDER_PAGE_COPY.status;

export interface OrderStatusMenuProps {
  order: OrderDetailResponse;
  /** A move succeeded and the page already has the answer; an end state is a Completed or Cancelled answer. */
  onMoved?: ((answer: OrderDetailResponse) => void) | undefined;
}

/** Which item takes focus when the menu opens. */
type OpenAt = 'first' | 'last';

interface MenuState {
  readonly open: boolean;
  /** Outlives `open`, so a closing popover keeps its props. */
  readonly at: OpenAt;
}

/**
 * One move. `id` names the order and the status together, because useOrderAction keys a submission by its target id: a retry of
 * the same move keeps its Idempotency-Key, and a different status is a new submission with a new key.
 */
interface MoveTarget {
  readonly id: string;
  readonly status: string;
}

/** The menu's items, in order. */
function menuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

export function OrderStatusMenu({ order, onMoved }: OrderStatusMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>({ open: false, at: 'first' });
  const [cancelOpen, setCancelOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  const { open, at } = menuState;
  const presence = usePresence(open);

  const showFailure = (error: unknown): void => {
    if (isHttpError(error) && error.kind === 'http') {
      if (error.status === 422 || error.status === 404) {
        // The page is out of date as well as refused: read the order again, so the next open reflects the latest order.
        void refetchOrder(order.id);
      }
      if (error.status === 422 && error.problem?.detail !== undefined) {
        toast.show({ tone: 'danger', title: COPY.failed, message: error.problem.detail });
        return;
      }
      if (error.status === 404) {
        toast.show({ tone: 'danger', title: COPY.failed, message: COPY.notFound });
        return;
      }
    }
    const copy = describeHttpError(error);
    if (copy !== null) {
      toast.show({ tone: 'danger', title: COPY.failed, message: errorLine(copy) });
    }
  };

  const move = useOrderAction<MoveTarget>(
    (key, target) => ordersService.changeStatus(order.id, target.status, key),
    (answer) => {
      applyOrder(answer);
      if (answer.status === 'completed') {
        toast.show({ tone: 'success', title: COPY.completed.title, message: COPY.completed.message(answer.number) });
      } else {
        toast.show({
          tone: 'success',
          title: COPY.moved.title,
          message: COPY.moved.message(answer.number, orderStatusLabel(answer.status)),
        });
      }
      onMoved?.(answer);
    },
    showFailure,
  );

  const openMenu = (next: OpenAt): void => {
    setMenuState({ open: true, at: next });
  };

  const close = (focusButton: boolean): void => {
    setMenuState((state) => ({ ...state, open: false }));
    if (focusButton) {
      buttonRef.current?.focus();
    }
  };

  const moveTo = (status: string): void => {
    close(true);
    void move.submit({ id: `${order.id}:${status}`, status });
  };

  // The button has focus before the confirm opens, so Keep Order returns to it.
  const askToCancel = (): void => {
    close(true);
    setCancelOpen(true);
  };

  // ArrowDown and ArrowUp on the button open the menu on its first or last item. A busy button ignores them.
  const onArrow = useEffectEvent((event: globalThis.KeyboardEvent): void => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !move.pending) {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  useEffect(() => {
    const button = buttonRef.current;
    if (button === null) {
      return undefined;
    }
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
        id={CHANGE_STATUS_ID}
        variant="secondary"
        size="sm"
        iconRight="chevron-down"
        pending={move.pending}
        aria-haspopup="menu"
        aria-expanded={open}
        {...(open ? { 'aria-controls': menuId } : {})}
        onClick={() => {
          if (open) {
            close(false);
          } else {
            openMenu('first');
          }
        }}
      >
        {move.pending ? COPY.saving : COPY.menu}
      </Button>
      {presence.mounted && (
        <MenuPopover
          id={menuId}
          open={open}
          openAt={at}
          presenceRef={presence.ref}
          buttonRef={buttonRef}
          order={order}
          onClose={close}
          onMove={moveTo}
          onCancelOrder={askToCancel}
        />
      )}
      <CancelOrderDialog
        order={order}
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
        }}
        onCancelled={onMoved}
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
  order: OrderDetailResponse;
  /** Closes the menu; `true` puts focus back on the button. */
  onClose: (focusButton: boolean) => void;
  /** Moves to a status; Completed is a move too (D-47: no confirm). */
  onMove: (status: string) => void;
  onCancelOrder: () => void;
}

function MenuPopover({
  id,
  open,
  openAt,
  presenceRef,
  buttonRef,
  order,
  onClose,
  onMove,
  onCancelOrder,
}: MenuPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(onClose);
  const completable = canComplete(order);

  const setMenu = (node: HTMLDivElement | null): void => {
    menuRef.current = node;
    presenceRef(node);
  };

  // Focus the first or the last item on open; close on a press outside the menu and its button. Only while open.
  useEffect(() => {
    const menu = menuRef.current;
    if (menu === null || !open) {
      return undefined;
    }
    const items = menuItems(menu);
    (openAt === 'first' ? items[0] : items.at(-1))?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && !menu.contains(target) && buttonRef.current?.contains(target) !== true) {
        requestClose(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, openAt, buttonRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!open) {
      return;
    }
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
    const items = menuItems(event.currentTarget);
    const index = items.findIndex((element) => element === document.activeElement);
    const next = rovingItem(items, index, event.key, 'menu');
    if (next !== undefined) {
      event.preventDefault();
      next.item.focus();
    }
  };

  return (
    <div
      ref={setMenu}
      id={id}
      role="menu"
      aria-labelledby={CHANGE_STATUS_ID}
      tabIndex={-1}
      data-state={open ? 'open' : 'closed'}
      inert={open ? undefined : true}
      className={orderStatusMenuPopoverClasses}
      onKeyDown={onKeyDown}
    >
      {otherActiveStatuses(order.status).map((status) => (
        <button
          key={status}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={orderStatusItemClasses}
          onClick={() => {
            if (open) {
              onMove(status);
            }
          }}
        >
          <span className={orderStatusIconSlotClasses}>
            <OrderStatusDot status={status} />
          </span>
          <span>{COPY.moveTo(orderStatusLabel(status))}</span>
        </button>
      ))}
      <div role="separator" className={orderStatusDividerClasses} />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-disabled={completable ? undefined : true}
        className={orderStatusItemClasses}
        onClick={() => {
          // A disabled item stays focusable and does nothing; the reason is on screen.
          if (open && completable) {
            onMove('completed');
          }
        }}
      >
        <span className={orderStatusIconSlotClasses}>
          <Icon name="circle-check" size={18} />
        </span>
        <span className={orderStatusItemTextClasses}>
          <span>{COPY.markCompleted}</span>
          {!completable && <span className={orderStatusReasonClasses}>{COPY.completeReason}</span>}
        </span>
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={clsx(orderStatusItemClasses, orderStatusDangerItemClasses)}
        onClick={() => {
          if (open) {
            onCancelOrder();
          }
        }}
      >
        <span className={orderStatusIconSlotClasses}>
          <Icon name="x" size={18} />
        </span>
        <span>{COPY.cancelOrder}</span>
      </button>
    </div>
  );
}
