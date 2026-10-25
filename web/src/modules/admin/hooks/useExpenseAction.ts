// One single-click action on one expense (Delete, Restore, Delete permanently; plan 06-16) through useSubmission: a double click
// sends one request, and a retry after a failure that may have run keeps its Idempotency-Key. A finished action is the same
// submission as the next one on that expense (the data is equal), so it would send nothing; the identity carries a generation
// that moves on once the lists have read again, which is when the row shows the new state and the next click is a new intent.
import { useRef } from 'react';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';

export function useExpenseAction<TExpense extends { readonly id: string }>(
  send: (key: string, expense: TExpense) => Promise<void>,
  /** Runs after a success; return the lists' refresh so the generation moves on only once they have read again. */
  onSuccess: (expense: TExpense) => Promise<unknown>,
): SubmissionState<TExpense, void> {
  const generation = useRef(0);
  return useSubmission(send, {
    identity: (expense) => `${expense.id}:${String(generation.current)}`,
    onSuccess: (_result, expense) => {
      void onSuccess(expense).then(() => {
        generation.current += 1;
      });
    },
  });
}
