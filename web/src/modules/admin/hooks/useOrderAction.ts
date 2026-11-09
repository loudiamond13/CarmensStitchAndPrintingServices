// One single-click action on one child of an order (Delete Item, and the other row deletes; plan 08-14) through useSubmission: a
// double click sends one request. A finished action is the same submission as the next one on that row (the data is equal), so it
// would send nothing; the identity carries a generation that moves on once the success work has finished, which is when the row
// shows the new state and the next click is a new intent. Most actions answer the whole order; a restore or a delete for good answers nothing.
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { mayHaveSaved } from '@/lib/forms/mayHaveSaved';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import { orderRootKey } from '@/modules/admin/hooks/useOrderQuery';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export function useOrderAction<TTarget extends { readonly id: string }, TResult = OrderDetailResponse>(
  send: (key: string, target: TTarget) => Promise<TResult>,
  /** Runs after a success with the server's answer (nothing for a restore); return a promise (the lists' refresh) to move the generation on after it. */
  onSuccess: (result: TResult, target: TTarget) => unknown,
  /** Runs after a failure that has something to show, with the raw error. */
  onFailure?: (error: unknown) => void,
): SubmissionState<TTarget, TResult> {
  const generation = useRef(0);
  const queryClient = useQueryClient();
  const refreshOrders = useRefreshOrders();
  return useSubmission(send, {
    identity: (target) => `${target.id}:${String(generation.current)}`,
    onSuccess: (result, target) => {
      const advance = (): void => {
        generation.current += 1;
      };
      let done: unknown;
      try {
        done = onSuccess(result, target);
      } catch (error) {
        advance();
        throw error;
      }
      void Promise.resolve(done).finally(advance);
    },
    onFailure: (_copy, error) => {
      // A failure that may have saved (a server error, a timeout, no answer) leaves the order and the money old, so they are read again.
      if (mayHaveSaved(error)) {
        void queryClient.invalidateQueries({ queryKey: orderRootKey });
        void refreshOrders();
      }
      onFailure?.(error);
    },
  });
}
