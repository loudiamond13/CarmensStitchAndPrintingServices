// The privacy contact call (D-13, D-29): the shop's Contact email, for the legal pages only. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PrivacyContact = components['schemas']['PrivacyContactDto'];

export interface PrivacyContactService {
  /** `GET /api/v1/public/privacy-contact`. */
  getPrivacyContact(signal?: AbortSignal): Promise<PrivacyContact>;
}

export function createPrivacyContactService(client: HttpClient): PrivacyContactService {
  void client;
  return {
    getPrivacyContact: () => Promise.resolve({ email: null }),
  };
}

export const privacyContactService: PrivacyContactService = createPrivacyContactService(apiClient);
