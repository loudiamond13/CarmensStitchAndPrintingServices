// Site settings calls (WEB-04). Types come from the generated OpenAPI types (D-16).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type SiteSettings = components['schemas']['SiteSettingsDto'];
/** The Business Info form as the API takes it: every field, with the version the form was opened with. */
export type UpdateSiteSettingsRequest = components['schemas']['UpdateSiteSettingsRequest'];

export interface SiteSettingsService {
  /** `GET /api/v1/site-settings`. */
  get(signal?: AbortSignal): Promise<SiteSettings>;
  /**
   * `PUT /api/v1/site-settings` (Manager only): saves the Business Info form and answers the settings as saved. The body carries the
   * version the form was opened with: 409 `edit.stale` when it is not the stored one. A form save is never retried, so it carries no
   * Idempotency-Key (SEC-07). 400 lists the field errors, keyed by field (a phone row as `phones[0].number`), 403 for an Admin.
   */
  update(body: UpdateSiteSettingsRequest, signal?: AbortSignal): Promise<SiteSettings>;
}

export function createSiteSettingsService(client: HttpClient): SiteSettingsService {
  return {
    get: (signal) => client.get<SiteSettings>('/site-settings', { signal }),
    update: (body, signal) => client.put<SiteSettings>('/site-settings', body, { signal }),
  };
}

export const siteSettingsService: SiteSettingsService = createSiteSettingsService(apiClient);
