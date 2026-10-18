// RED stub: the real service lands in the GREEN commit.
import type { HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProfileResponse = Schemas['ProfileResponse'];
export type UpdateProfileNameRequest = Schemas['UpdateProfileNameRequest'];

export interface ProfileService {
  get(signal?: AbortSignal): Promise<ProfileResponse>;
  updateName(body: UpdateProfileNameRequest, signal?: AbortSignal): Promise<ProfileResponse>;
}

export function createProfileService(_client: HttpClient): ProfileService {
  return {
    get: () => Promise.reject(new Error('not implemented')),
    updateName: () => Promise.reject(new Error('not implemented')),
  };
}

export const profileService: ProfileService = createProfileService({} as HttpClient);
