// Site settings calls (WEB-04). Types come from the generated OpenAPI types (D-16).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type SiteSettings = components['schemas']['SiteSettingsDto'];
/** The link preview picture as the settings read answers it: the 320 and 640 preview addresses and the stored size. */
export type SharePicture = components['schemas']['SharePictureDto'];
/** The Business Info form as the API takes it: every field, with the version the form was opened with. */
export type UpdateSiteSettingsRequest = components['schemas']['UpdateSiteSettingsRequest'];

/** A picture upload may take a while on a slow mobile connection (D-31). */
const UPLOAD_TIMEOUT_MS = 120_000;

const SHARE_PICTURE_PATH = '/site-settings/share-picture';
const QUOTE_ALERT_TEST_PATH = '/site-settings/quote-alerts/test';

export interface SiteSettingsService {
  /** `GET /api/v1/site-settings`. */
  get(signal?: AbortSignal): Promise<SiteSettings>;
  /**
   * `PUT /api/v1/site-settings` (Manager only): saves the Business Info form and answers the settings as saved. The body carries the
   * version the form was opened with: 409 `edit.stale` when it is not the stored one. A form save is never retried, so it carries no
   * Idempotency-Key (SEC-07). 400 lists the field errors, keyed by field (a phone row as `phones[0].number`), 403 for an Admin.
   */
  update(body: UpdateSiteSettingsRequest, signal?: AbortSignal): Promise<SiteSettings>;
  /**
   * `POST /api/v1/site-settings/share-picture` (Manager only): sets the link preview picture from a multipart form (part `file`) and answers
   * the picture. A picture that is already set is replaced. The caller supplies one Idempotency-Key per file. The settings row's version
   * moves, so the caller reads the settings again. 400 `images.type`, `images.too-large`, `images.too-big`, 413, 429, 503. A keyed form
   * upload is never retried by the client.
   */
  uploadSharePicture(file: Blob, fileName: string, idempotencyKey: string, signal?: AbortSignal): Promise<SharePicture>;
  /** `DELETE /api/v1/site-settings/share-picture`: takes the picture off. No body, no Idempotency-Key. 404 when none is set. */
  removeSharePicture(signal?: AbortSignal): Promise<void>;
  /**
   * `POST /api/v1/site-settings/quote-alerts/test` (Manager only, D-11): emails a test to the saved Quote alerts address and answers 202
   * with no body. The caller supplies one Idempotency-Key per press. 409 `site-settings.no-quote-alerts-address` when none is saved,
   * 422 when the address can never receive mail, 429 after 3 tests in 10 minutes.
   */
  sendQuoteAlertTest(idempotencyKey: string, signal?: AbortSignal): Promise<void>;
}

export function createSiteSettingsService(client: HttpClient): SiteSettingsService {
  return {
    get: (signal) => client.get<SiteSettings>('/site-settings', { signal }),
    update: (body, signal) => client.put<SiteSettings>('/site-settings', body, { signal }),
    uploadSharePicture: (file, fileName, idempotencyKey, signal) => {
      const form = new FormData();
      form.append('file', file, fileName);
      return client.post<SharePicture>(SHARE_PICTURE_PATH, form, {
        idempotencyKey,
        signal,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },
    removeSharePicture: (signal) => client.delete(SHARE_PICTURE_PATH, { signal }),
    sendQuoteAlertTest: (idempotencyKey, signal) => client.post(QUOTE_ALERT_TEST_PATH, undefined, { idempotencyKey, signal }),
  };
}

export const siteSettingsService: SiteSettingsService = createSiteSettingsService(apiClient);
