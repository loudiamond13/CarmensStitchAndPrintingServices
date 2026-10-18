// My Profile calls (PROF-01, SEC-07). Types come from the generated OpenAPI types (D-16). Both calls act on the signed-in
// person only: the route carries no user id. The save sends the edit version the form was opened with; a version that is
// no longer current answers 409 `edit.stale`. A PUT repeats safely, so it carries no Idempotency-Key.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProfileResponse = Schemas['ProfileResponse'];
export type UpdateProfileNameRequest = Schemas['UpdateProfileNameRequest'];

export interface ProfileService {
  /** `GET /api/v1/profile`: the names, sign-in email, role, pending email, member-since date and edit version. */
  get(signal?: AbortSignal): Promise<ProfileResponse>;
  /** `PUT /api/v1/profile`: saves the names against the version; resolves the saved profile with its new version. */
  updateName(body: UpdateProfileNameRequest, signal?: AbortSignal): Promise<ProfileResponse>;
}

export function createProfileService(client: HttpClient): ProfileService {
  return {
    get: (signal) => client.get<ProfileResponse>('/profile', { signal }),
    updateName: (body, signal) => client.put<ProfileResponse>('/profile', body, { signal }),
  };
}

export const profileService: ProfileService = createProfileService(apiClient);
