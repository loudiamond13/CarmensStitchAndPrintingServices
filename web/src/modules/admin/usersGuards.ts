// The words for a refusal on a user action that a Manager reads but cannot fix by trying again (UI-SPEC "Error and guard
// states"; D-09, D-18, D-19; plans 05-28 and 05-30): the last active Manager, one's own account, a person deleted meanwhile,
// a locked or deactivated person, a person who already has (or has not yet set) a password, and the hourly reset-link cap.
// Any other failure is left to describeHttpError.
import { isHttpError } from '@/core/api/errors';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import type { ErrorCopy } from '@/utils/describeHttpError';

const GUARDS: ReadonlyMap<string, ErrorCopy> = new Map<string, ErrorCopy>([
  ['users.last-active-manager', USERS_COPY.edit.guards.lastManager],
  ['users.own-account', USERS_COPY.edit.guards.ownAccount],
  ['users.blocked', USERS_COPY.edit.guards.blocked],
  ['users.already-set-up', USERS_COPY.edit.guards.alreadySetUp],
  ['users.no-password', USERS_COPY.edit.guards.noPassword],
  ['users.reset-link-capped', USERS_COPY.edit.guards.resetLinkCapped],
]);

/** The guard words for a 422 refusal, the 429 reset-link cap or a 404, else undefined. */
export function describeUserGuard(error: unknown): ErrorCopy | undefined {
  if (!isHttpError(error)) {
    return undefined;
  }
  if (error.status === 404) {
    return USERS_COPY.edit.guards.deleted;
  }
  return error.status === 422 || error.status === 429 ? GUARDS.get(error.code ?? '') : undefined;
}
