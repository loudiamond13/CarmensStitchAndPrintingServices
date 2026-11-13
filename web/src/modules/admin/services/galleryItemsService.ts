// Gallery item calls (WEB-04, GAL-03). Types come from the generated OpenAPI types (D-16). All eight are the Manager's.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

/** One gallery item (a shown order or an upload) as the Manager's list reads it. */
export type GalleryItem = Schemas['GalleryItemRowDto'];
/** One page of the Manager's list. */
export type GalleryItemPage = Schemas['GalleryItemListDto'];
/** The upload form as the API takes it (JSON on an edit). */
export type GalleryUploadRequest = Schemas['GalleryUploadRequest'];
/** Which way a move goes. */
export type MoveDirection = 'up' | 'down';

/** What the list asks for: a line (null for every line), the page from 1 and the rows per page. */
export interface GalleryListQuery {
  line: string | null;
  page: number;
  pageSize: number;
}

/** What an add sends: the prepared photo and the form fields (each a part of the multipart form). */
export interface GalleryAddForm {
  file: Blob;
  fileName: string;
  teamName: string;
  productLineId: string;
  pieces: number | null;
  note: string;
  isShown: boolean;
}

/** A photo upload may take a while on a slow mobile connection (D-31). */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface GalleryItemsService {
  /** `GET /api/v1/gallery-items`: one page of every shown order and every upload in gallery order, with an optional line filter. */
  list(query: GalleryListQuery, signal?: AbortSignal): Promise<GalleryItemPage>;
  /**
   * `POST /api/v1/gallery-items`: adds a photo for older work as a multipart form (part `file` and the text parts). It joins the top. The caller
   * supplies one Idempotency-Key per submission. 400 lists the field errors or the photo refusal, 409, 413, 429, 503. A keyed upload is never
   * retried by the client.
   */
  create(form: GalleryAddForm, idempotencyKey: string, signal?: AbortSignal): Promise<GalleryItem>;
  /**
   * `PUT /api/v1/gallery-items/{id}`: saves the form of an upload. The body carries the version the form was opened with: 409 `edit.stale` when
   * it is not the stored one. A form edit is never retried, so it carries no Idempotency-Key. 400 lists the field errors, 404.
   */
  update(id: string, body: GalleryUploadRequest, signal?: AbortSignal): Promise<GalleryItem>;
  /** `POST /api/v1/gallery-items/{id}/photo`: puts a new file in place of the photo and answers the item with its new version. One key per file. */
  replacePhoto(
    id: string,
    file: Blob,
    fileName: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<GalleryItem>;
  /** `POST /api/v1/gallery-items/{id}/move`: swaps with the visible neighbour (the next item of the line when `lineId` is set). One key per attempt. */
  move(
    id: string,
    direction: MoveDirection,
    lineId: string | null,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<void>;
  /** `POST /api/v1/gallery-items/{id}/hide`: takes an upload off the website. One Idempotency-Key per attempt. 404. */
  hide(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/gallery-items/{id}/show`: puts an upload on the website. One Idempotency-Key per attempt. 404. */
  show(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/gallery-items/{id}`: removes an upload for good. No version, no Idempotency-Key. 404 when it is gone. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const itemPath = (id: string): string => `/gallery-items/${encodeURIComponent(id)}`;

export function createGalleryItemsService(client: HttpClient): GalleryItemsService {
  return {
    list: (query, signal) =>
      client.get<GalleryItemPage>('/gallery-items', {
        params: { line: query.line, page: query.page, pageSize: query.pageSize },
        signal,
      }),
    create: (form, idempotencyKey, signal) => {
      const body = new FormData();
      body.append('file', form.file, form.fileName);
      body.append('teamName', form.teamName);
      body.append('productLineId', form.productLineId);
      if (form.pieces !== null) {
        body.append('pieces', String(form.pieces));
      }
      body.append('note', form.note);
      body.append('isShown', String(form.isShown));
      return client.post<GalleryItem>('/gallery-items', body, { idempotencyKey, signal, timeoutMs: UPLOAD_TIMEOUT_MS });
    },
    update: (id, body, signal) => client.put<GalleryItem>(itemPath(id), body, { signal }),
    replacePhoto: (id, file, fileName, idempotencyKey, signal) => {
      const body = new FormData();
      body.append('file', file, fileName);
      return client.post<GalleryItem>(`${itemPath(id)}/photo`, body, {
        idempotencyKey,
        signal,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },
    move: (id, direction, lineId, idempotencyKey, signal) =>
      client.post(
        `${itemPath(id)}/move`,
        lineId === null ? { direction } : { direction, lineId },
        { idempotencyKey, signal },
      ),
    hide: (id, idempotencyKey, signal) => client.post(`${itemPath(id)}/hide`, undefined, { idempotencyKey, signal }),
    show: (id, idempotencyKey, signal) => client.post(`${itemPath(id)}/show`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(itemPath(id), { signal }),
  };
}

export const galleryItemsService: GalleryItemsService = createGalleryItemsService(apiClient);
