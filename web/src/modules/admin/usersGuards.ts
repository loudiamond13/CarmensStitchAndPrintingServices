// The words for a refusal on a roster action that a Manager reads but cannot fix by trying again (UI-SPEC "Error and guard
// states"; D-09, D-18, D-19; plan 05-28): the last active Manager, one's own account, and a person deleted meanwhile.
// Any other failure is left to describeHttpError.
import { isHttpError } from '@/core/api/errors';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import type { ErrorCopy } from '@/utils/describeHttpError';

const GUARDS: ReadonlyMap<string, ErrorCopy> = new Map<string, ErrorCopy>([
  ['users.last-active-manager', USERS_COPY.edit.guards.lastManager],
  ['users.own-account', USERS_COPY.edit.guards.ownAccount],
]);

/** The guard words for a 422 refusal or a 404, else undefined. */
export function describeUserGuard(error: unknown): ErrorCopy | undefined {
  if (!isHttpError(error)) {
    return undefined;
  }
  if (error.status === 404) {
    return USERS_COPY.edit.guards.deleted;
  }
  return error.status === 422 ? GUARDS.get(error.code ?? '') : undefined;
}
