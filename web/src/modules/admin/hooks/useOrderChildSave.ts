// The save path every order window shares (UI-SPEC O2 Outcomes; plan 08-14): one submission per window with its own key, the
// server's answer set on the order page, the D-05 toast, and each failure shown where the person is looking. The window keeps
// the order version it opened with and puts it in the data it submits, so a retry of the same values keeps its key and a changed
// version is a new submission (RESEARCH Pitfall 10).
import { useState } from 'react';
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { useSubmission, type FieldErrors } from '@/lib/forms/useSubmission';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { ORDER_WINDOWS_COPY, type OrderThing, type OrderVerb } from '@/modules/admin/orderWindowsCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const TOAST = ORDER_WINDOWS_COPY.toast;

/** What the window shows above its fields. */
export type OrderWindowBanner =
  | { readonly kind: 'conflict'; readonly count: number }
  | { readonly kind: 'removed'; readonly title: string; readonly body: string }
  | { readonly kind: 'message'; readonly text: string };

/** How the window stands: ready, saving, or refused in a way that needs the person to act. */
export type OrderChildState = 'idle' | 'pending' | 'conflict' | 'removed' | 'locked' | 'refused';

/** The toast of a saved window: the title names the thing, the message names the server's balance (D-05). */
export function orderSavedMessage(
  order: Pick<OrderDetailResponse, 'totals'>,
  thing: OrderThing,
  verb: OrderVerb,
): { title: string; message: string } {
  const { totals } = order;
  const title = TOAST.title(thing, verb);
  if (thing === 'expense') {
    return { title, message: TOAST.expenses(formatPeso(totals.expenses)) };
  }
  if (isPositiveMoney(totals.customerCredit)) {
    return { title, message: TOAST.credit(formatPeso(totals.customerCredit)) };
  }
  if (totals.fullyPaid) {
    return { title, message: TOAST.fullyPaid };
  }
  return { title, message: TOAST.balance(formatPeso(totals.balance)) };
}

export interface OrderChildSaveOptions<TData> {
  orderId: string;
  thing: OrderThing;
  /** Adding or changing: the toast title says which. */
  verb: Exclude<OrderVerb, 'deleted'>;
  /** The request. Add passes the key to the POST; an edit ignores it. */
  send: (key: string, data: TData) => Promise<OrderDetailResponse>;
  /** The save succeeded and the page already has the answer: close the window. */
  onSaved: (order: OrderDetailResponse) => void;
  /** Puts the server's field messages under their fields; true when at least one landed on a rendered field. */
  onFieldErrors?: ((errors: FieldErrors) => boolean) | undefined;
}

export interface OrderChildSave<TData> {
  submit: (data: TData) => void;
  pending: boolean;
  state: OrderChildState;
  banner: OrderWindowBanner | null;
  fieldErrors: FieldErrors;
  /** Save stays aria-disabled: the order is locked or the record is gone. */
  saveBlocked: boolean;
}

/** The server's own sentence for a refusal (CspsProblemDetails puts it in `detail`). */
function serverSentence(error: unknown, fallback: string): string {
  return isHttpError(error) ? (error.problem?.detail ?? fallback) : fallback;
}

export function useOrderChildSave<TData>({
  orderId,
  thing,
  verb,
  send,
  onSaved,
  onFieldErrors,
}: OrderChildSaveOptions<TData>): OrderChildSave<TData> {
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  const [banner, setBanner] = useState<OrderWindowBanner | null>(null);
  const [state, setState] = useState<OrderChildState>('idle');

  const showLine = (text: string): void => {
    setBanner({ kind: 'message', text });
    setState('refused');
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    if (isHttpError(error) && error.kind === 'http') {
      if (error.status === 400) {
        if (onFieldErrors?.(error.fieldErrors) === true) {
          setBanner(null);
          return;
        }
        showLine(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
        return;
      }
      if (error.status === 422) {
        // The page is out of date as well as refused: read the order again.
        void refetchOrder(orderId);
        showLine(serverSentence(error, errorLine(copy)));
        setState(error.code === 'orders.locked' ? 'locked' : 'refused');
        return;
      }
    }
    showLine(errorLine(copy));
  };

  const submission = useSubmission<TData, OrderDetailResponse>(send, {
    onSuccess: (order) => {
      applyOrder(order);
      toast.show({ tone: 'success', ...orderSavedMessage(order, thing, verb) });
      onSaved(order);
    },
    onFailure: showFailure,
  });

  const submit = (data: TData): void => {
    setBanner(null);
    setState('idle');
    void submission.submit(data);
  };

  return {
    submit,
    pending: submission.pending,
    state: submission.pending ? 'pending' : state,
    banner,
    fieldErrors: submission.fieldErrors,
    saveBlocked: state === 'locked' || state === 'removed',
  };
}
