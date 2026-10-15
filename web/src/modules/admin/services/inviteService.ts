// Invite calls (AUTH-12, D-29). Types come from the generated OpenAPI types. Both calls are anonymous, so a 401 or 404 is
// the answer, never an ended session (skipAuthRefresh). Accept is covered by the Idempotency-Key gate (SEC-06, D-40); the
// caller supplies one key per submission. The token travels in the body only.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
import type { KeyedCall } from './passwordService';

type Schemas = components['schemas'];

export type InviteTokenRequest = Schemas['InviteTokenRequest'];
export type InviteLinkResponse = Schemas['InviteLinkResponse'];
export type AcceptInviteRequest = Schemas['AcceptInviteRequest'];

export interface InviteService {
  /** `POST /api/v1/auth/invite/check`: the email and first name behind a usable invite, or 404 `auth.invite-invalid`. */
  check(body: InviteTokenRequest, signal?: AbortSignal): Promise<InviteLinkResponse>;
  /** `POST /api/v1/auth/invite/accept`: saves the first password and confirms the address (204, no session). */
  accept(body: AcceptInviteRequest, call: KeyedCall): Promise<void>;
}

export function createInviteService(client: HttpClient): InviteService {
  return {
    check: (body, signal) => client.post('/auth/invite/check', body, { signal, skipAuthRefresh: true }),
    accept: (body, { idempotencyKey, signal }) =>
      client.post('/auth/invite/accept', body, { idempotencyKey, signal, skipAuthRefresh: true }),
  };
}

export const inviteService: InviteService = createInviteService(apiClient);
