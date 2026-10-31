// One roster action on one person (Deactivate, Activate, Delete; plan 05-28) through useSubmission: a double click sends one
// request, and a retry after a failure that may have run keeps its Idempotency-Key. A finished action is the same submission
// as the next one on that person (the data is equal), so it would send nothing; the identity carries a generation that moves
// on once the roster has read again, which is when the row shows the new state and the next click is a new intent.
import { useRef } from 'react';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import type { UserListItem } from '@/modules/admin/services/usersService';

export function useUserAction(
  send: (key: string, user: UserListItem) => Promise<void>,
  /** Runs after a success; return the roster's refresh so the generation moves on only once it has read again. */
  onSuccess: (user: UserListItem) => Promise<unknown>,
): SubmissionState<UserListItem, void> {
  const generation = useRef(0);
  return useSubmission(send, {
    identity: (user) => `${user.id}:${String(generation.current)}`,
    onSuccess: (_result, user) => {
      void onSuccess(user).then(() => {
        generation.current += 1;
      });
    },
  });
}
