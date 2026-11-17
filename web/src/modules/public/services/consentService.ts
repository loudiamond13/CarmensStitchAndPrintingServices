// The consent call (ANL-07, OR-5): one typed POST over the shared client. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type ConsentDecision = components['schemas']['ConsentDecisionResponse'];

/** Where the choice was made. The server also knows `clear`, which only the server sends. */
export type ConsentSource = 'bar' | 'settings' | 'map-link';

export interface ConsentRecordBody {
  /** The chain id from the saved cookie; left out on a first decision. */
  consentId?: string;
  policyVersion: string;
  stats: boolean | null;
  map: boolean;
  source: ConsentSource;
}

export interface ConsentService {
  /** `POST /api/v1/analytics/consent`: logs the decision; the server sets the consent cookie. */
  record(body: ConsentRecordBody, signal?: AbortSignal): Promise<ConsentDecision>;
}

export function createConsentService(client: HttpClient): ConsentService {
  return {
    record: (body, signal) => client.post<ConsentDecision>('/analytics/consent', body, { signal }),
  };
}

export const consentService: ConsentService = createConsentService(apiClient);
