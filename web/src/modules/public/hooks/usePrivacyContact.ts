// The shop's Contact email for the four legal pages (D-13, D-29). It has no boot key, so no other page ever carries it.
import { createPublicResource, type PublicResourceState } from '@/lib/public-data/publicResource';
import type { PrivacyContact } from '../services/privacyContactService';

/** Reads again after five minutes. */
export const PRIVACY_CONTACT_STALE_MS = 5 * 60 * 1000;

// The service loads only when a legal page needs the email, so the public first download does not grow (PERF-01).
export const privacyContactResource = createPublicResource<PrivacyContact>({
  load: async (signal) =>
    (await import('../services/privacyContactService')).privacyContactService.getPrivacyContact(signal),
  staleMs: PRIVACY_CONTACT_STALE_MS,
});

export function usePrivacyContact(): PublicResourceState<PrivacyContact> {
  return privacyContactResource.useResource();
}
