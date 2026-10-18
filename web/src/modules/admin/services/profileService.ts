// My Profile calls (PROF-01, PROF-02, SEC-07). Types come from the generated OpenAPI types (D-16). The profile calls act on
// the signed-in person only: the route carries no user id. The save sends the edit version the form was opened with; a
// version that is no longer current answers 409 `edit.stale`. A PUT repeats safely, so it carries no Idempotency-Key.
// The two email-change link calls are anonymous (the link is the proof): the token goes in the body, never in a URL, and a
// 401 is never an ended session (skipAuthRefresh).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProfileResponse = Schemas['ProfileResponse'];
export type UpdateProfileNameRequest = Schemas['UpdateProfileNameRequest'];
export type EmailChangeResponse = Schemas['EmailChangeResponse'];

export interface ProfileService {
  /** `GET /api/v1/profile`: the names, sign-in email, role, pending email, member-since date and edit version. */
  get(signal?: AbortSignal): Promise<ProfileResponse>;
  /** `PUT /api/v1/profile`: saves the names against the version; resolves the saved profile with its new version. */
  updateName(body: UpdateProfileNameRequest, signal?: AbortSignal): Promise<ProfileResponse>;
  /** `POST /api/v1/profile/email-change/check`: read-only; the address the link would confirm, 404 or 409 `email-change.taken`. */
  checkEmailChange(token: string, signal?: AbortSignal): Promise<EmailChangeResponse>;
  /** `POST /api/v1/profile/email-change/confirm`: applies the change; the caller supplies one key per press. */
  confirmEmailChange(token: string, idempotencyKey: string, signal?: AbortSignal): Promise<EmailChangeResponse>;
}

export function createProfileService(client: HttpClient): ProfileService {
  return {
    get: (signal) => client.get<ProfileResponse>('/profile', { signal }),
    updateName: (body, signal) => client.put<ProfileResponse>('/profile', body, { signal }),
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
