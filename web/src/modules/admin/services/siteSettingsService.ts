// Site settings calls (WEB-04). Types come from the generated OpenAPI types (D-16).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type SiteSettings = components['schemas']['SiteSettingsDto'];

export interface SiteSettingsService {
  /** `GET /api/v1/site-settings`. */
  get(signal?: AbortSignal): Promise<SiteSettings>;
}

export function createSiteSettingsService(client: HttpClient): SiteSettingsService {
  return {
    get: (signal) => client.get<SiteSettings>('/site-settings', { signal }),
  };
}

export const siteSettingsService: SiteSettingsService = createSiteSettingsService(apiClient);
