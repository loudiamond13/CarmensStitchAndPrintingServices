// One single-click action on one child of an order (Delete Item, and the other row deletes; plan 08-14) through useSubmission: a
// double click sends one request. A finished action is the same submission as the next one on that row (the data is equal), so it
// would send nothing; the identity carries a generation that moves on once the success work has finished, which is when the row
// shows the new state and the next click is a new intent. Each action answers the whole order.
import { useRef } from 'react';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export function useOrderAction<TTarget extends { readonly id: string }>(
  send: (key: string, target: TTarget) => Promise<OrderDetailResponse>,
  /** Runs after a success with the server's answer; return a promise (the lists' refresh) to move the generation on after it. */
  onSuccess: (order: OrderDetailResponse, target: TTarget) => unknown,
  /** Runs after a failure that has something to show, with the raw error. */
  onFailure?: (error: unknown) => void,
): SubmissionState<TTarget, OrderDetailResponse> {
  const generation = useRef(0);
  return useSubmission(send, {
    identity: (target) => `${target.id}:${String(generation.current)}`,
    onSuccess: (order, target) => {
      void Promise.resolve(onSuccess(order, target)).then(() => {
        generation.current += 1;
      });
    },
    onFailure: (_copy, error) => {
      onFailure?.(error);
    },
  });
}
