// Product line calls (WEB-04, CONT-02). Types come from the generated OpenAPI types (D-16). All eight are the Manager's. A save from a form
// carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

/** One row of the Manager's list: every line, shown and hidden, in display order, with what Delete and the table need. */
export type ProductLineListItem = Schemas['ProductLineListItemDto'];
/** One line with every field, for the editor. */
export type ProductLineDetail = Schemas['ProductLineDetailDto'];
/** The line form as the API takes it: the texts, the price and minimum, the filed product types and, for an edit, the version. */
export type ProductLineRequest = Schemas['ProductLineRequest'];
/** One photo of a line as the Manager's screens read it. */
export type ProductLinePhoto = Schemas['ProductLinePhotoDto'];
/** The three photo slots of a line; a slot with no photo is null. */
export type ProductLinePhotos = Schemas['ProductLinePhotosDto'];
/** The place of a photo on a line. */
export type LinePhotoSlot = 'main' | 'back' | 'fabric';
/** Which way a move goes. */
export type MoveDirection = 'up' | 'down';

/** A photo upload may take a while on a slow mobile connection (D-31). */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface ProductLinesService {
  /** `GET /api/v1/product-lines`: every line in display order, hidden ones included, each with its version. */
  list(signal?: AbortSignal): Promise<ProductLineListItem[]>;
  /** `GET /api/v1/product-lines/{id}`: one line with every field. 404 `product-lines.not-found`. */
  get(id: string, signal?: AbortSignal): Promise<ProductLineDetail>;
  /**
   * `POST /api/v1/product-lines`: adds a line (hidden until it is shown). The caller supplies one Idempotency-Key per submission.
   * 400 lists the field errors (a duplicate short name is one, under `shortName`), 409 when the save lost a deadlock.
   */
  create(body: ProductLineRequest, idempotencyKey: string, signal?: AbortSignal): Promise<ProductLineDetail>;
  /**
   * `PUT /api/v1/product-lines/{id}`: saves the form. The body carries the version the form was opened with: 409 `edit.stale` when it is
   * not the stored one. A form edit is never retried, so it carries no Idempotency-Key. 400 lists the field errors, 404 when it is gone.
   */
  update(id: string, body: ProductLineRequest, signal?: AbortSignal): Promise<ProductLineDetail>;
  /** `POST /api/v1/product-lines/{id}/move`: swaps the line with the next one in the list, one Idempotency-Key per attempt. 404. */
  move(id: string, direction: MoveDirection, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/product-lines/{id}/hide`: takes the line off the website. One Idempotency-Key per attempt. 404. */
  hide(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/product-lines/{id}/show`: puts the line on the website. One Idempotency-Key per attempt. 404. */
  show(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/product-lines/{id}`: removes a line nothing is filed under. No version, no Idempotency-Key. 422 `product-lines.in-use`, 404. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
  /**
   * `POST /api/v1/product-lines/{id}/photos/{slot}`: puts one photo into a slot as a multipart form (part `file`) and answers the photo. A slot
   * that holds one is replaced. One Idempotency-Key per file. 400 `images.type`, `images.too-large`, `images.too-big`, 404, 413, 429, 503. A keyed
   * form upload is never retried by the client.
   */
  uploadPhoto(
    id: string,
    slot: LinePhotoSlot,
    file: Blob,
    fileName: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ProductLinePhoto>;
  /** `DELETE /api/v1/product-lines/{id}/photos/{slot}`: takes the photo out. No body, no Idempotency-Key. 404 when the slot is already empty. */
  removePhoto(id: string, slot: LinePhotoSlot, signal?: AbortSignal): Promise<void>;
}

const linePath = (id: string): string => `/product-lines/${encodeURIComponent(id)}`;
const photoPath = (id: string, slot: LinePhotoSlot): string => `${linePath(id)}/photos/${slot}`;

export function createProductLinesService(client: HttpClient): ProductLinesService {
  return {
    list: (signal) => client.get<ProductLineListItem[]>('/product-lines', { signal }),
    get: (id, signal) => client.get<ProductLineDetail>(linePath(id), { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<ProductLineDetail>('/product-lines', body, { idempotencyKey, signal }),
    update: (id, body, signal) => client.put<ProductLineDetail>(linePath(id), body, { signal }),
    move: (id, direction, idempotencyKey, signal) =>
      client.post(`${linePath(id)}/move`, { direction }, { idempotencyKey, signal }),
    hide: (id, idempotencyKey, signal) => client.post(`${linePath(id)}/hide`, undefined, { idempotencyKey, signal }),
    show: (id, idempotencyKey, signal) => client.post(`${linePath(id)}/show`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(linePath(id), { signal }),
    uploadPhoto: (id, slot, file, fileName, idempotencyKey, signal) => {
      const form = new FormData();
      form.append('file', file, fileName);
      return client.post<ProductLinePhoto>(photoPath(id, slot), form, {
        idempotencyKey,
        signal,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },
    removePhoto: (id, slot, signal) => client.delete(photoPath(id, slot), { signal }),
  };
}

export const productLinesService: ProductLinesService = createProductLinesService(apiClient);
