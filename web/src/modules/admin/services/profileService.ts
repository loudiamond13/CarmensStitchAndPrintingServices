// My Profile calls (PROF-01, PROF-02, SEC-07). Types come from the generated OpenAPI types (D-16). The profile calls act on
// the signed-in person only: the route carries no user id. The save sends the edit version the form was opened with; a
// version that is no longer current answers 409 `edit.stale`. A PUT repeats safely, so it carries no Idempotency-Key.
// The two email-change link calls are anonymous (the link is the proof): the token goes in the body, never in a URL, and a
// 401 is never an ended session (skipAuthRefresh). The email-change request and resend are POSTs covered by the
// Idempotency-Key gate, so the caller supplies one key per submission; the cancel is a DELETE and repeats safely.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProfileResponse = Schemas['ProfileResponse'];
export type UpdateProfileNameRequest = Schemas['UpdateProfileNameRequest'];
export type EmailChangeResponse = Schemas['EmailChangeResponse'];
export type RequestEmailChangeRequest = Schemas['RequestEmailChangeRequest'];

export interface ProfileService {
  /** `GET /api/v1/profile`: the names, sign-in email, role, pending email, member-since date and edit version. */
  get(signal?: AbortSignal): Promise<ProfileResponse>;
  /** `PUT /api/v1/profile`: saves the names against the version; resolves the saved profile with its new version. */
  updateName(body: UpdateProfileNameRequest, signal?: AbortSignal): Promise<ProfileResponse>;
  /** `POST /api/v1/profile/email-change`: asks to change the sign-in email; resolves the profile with its pending email. */
  requestEmailChange(
    body: RequestEmailChangeRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ProfileResponse>;
  /** `POST /api/v1/profile/email-change/resend`: a fresh 24-hour link to the waiting address (204). */
  resendEmailChange(idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/profile/email-change`: calls off the waiting change (204, also when nothing is waiting). */
  cancelEmailChange(signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/profile/email-change/check`: read-only; the address the link would confirm, 404 or 409 `email-change.taken`. */
  checkEmailChange(token: string, signal?: AbortSignal): Promise<EmailChangeResponse>;
  /** `POST /api/v1/profile/email-change/confirm`: applies the change; the caller supplies one key per press. */
  confirmEmailChange(token: string, idempotencyKey: string, signal?: AbortSignal): Promise<EmailChangeResponse>;
}

export function createProfileService(client: HttpClient): ProfileService {
  return {
    get: (signal) => client.get<ProfileResponse>('/profile', { signal }),
    updateName: (body, signal) => client.put<ProfileResponse>('/profile', body, { signal }),
    requestEmailChange: (body, idempotencyKey, signal) =>
      client.post<ProfileResponse>('/profile/email-change', body, { idempotencyKey, signal }),
    resendEmailChange: (idempotencyKey, signal) =>
      client.post('/profile/email-change/resend', undefined, { idempotencyKey, signal }),
    cancelEmailChange: (signal) => client.delete('/profile/email-change', { signal }),
    checkEmailChange: (token, signal) =>
      client.post<EmailChangeResponse>('/profile/email-change/check', { token }, { signal, skipAuthRefresh: true }),
    confirmEmailChange: (token, idempotencyKey, signal) =>
      client.post<EmailChangeResponse>(
        '/profile/email-change/confirm',
        { token },
        { idempotencyKey, signal, skipAuthRefresh: true },
      ),
  };
}

export const profileService: ProfileService = createProfileService(apiClient);
