// The public site call (PUB-02): the shop facts every visitor sees. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PublicSite = components['schemas']['PublicSiteDto'];
export type OpenStatus = components['schemas']['OpenStatusDto'];

export interface SiteService {
  /** `GET /api/v1/public/site`. */
  getSite(signal?: AbortSignal): Promise<PublicSite>;
  /** `GET /api/v1/public/open-status`: whether the shop is open now, worked out by the server (PUB-05, D-22). */
  getOpenStatus(signal?: AbortSignal): Promise<OpenStatus>;
}

export function createSiteService(client: HttpClient): SiteService {
  return {
    getSite: (signal) => client.get<PublicSite>('/public/site', { signal }),
    getOpenStatus: (signal) => client.get<OpenStatus>('/public/open-status', { signal }),
  };
}

export const siteService: SiteService = createSiteService(apiClient);
