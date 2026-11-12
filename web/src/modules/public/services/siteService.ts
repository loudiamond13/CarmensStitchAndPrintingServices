// The public site call (PUB-02): the shop facts every visitor sees. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PublicSite = components['schemas']['PublicSiteDto'];

export interface SiteService {
  /** `GET /api/v1/public/site`. */
  getSite(signal?: AbortSignal): Promise<PublicSite>;
}

export function createSiteService(client: HttpClient): SiteService {
  void client;
  return { getSite: () => Promise.reject(new Error('Not built yet.')) };
}

export const siteService: SiteService = createSiteService(apiClient);
