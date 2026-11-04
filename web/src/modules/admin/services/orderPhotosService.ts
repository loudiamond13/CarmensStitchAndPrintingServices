// Photo calls on one order (ORD-04, IMG-01; OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { components } from '@/types/api.generated';

export type ImageRulesResponse = components['schemas']['ImageRulesResponse'];

/** A photo upload may take a while on a slow mobile connection (D-31). */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface OrderPhotosService {
  /** `GET /api/v1/orders/image-rules`: the limits the server enforces, so the browser can refuse a bad file first (OR-3). */
  rules(signal?: AbortSignal): Promise<ImageRulesResponse>;
  /**
   * `POST /api/v1/orders/{orderId}/images`: uploads one photo as a multipart form (parts `file` and `description`) and answers
   * the whole order. The caller supplies one Idempotency-Key per file and reuses it for Try Again, so the server stores the
   * photo once. `400 images.type`, `images.too-large`, `images.too-big`; `404 orders.not-found`; `409` busy; `413`;
   * `422 orders.images-full` or `orders.locked`; `429`; `503`. A keyed form upload is never retried by the client.
   */
  upload(
    orderId: string,
    file: Blob,
    fileName: string,
    description: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/images/{imageId}/position`: moves one photo to the 0-based `position` (0 is the cover, so Make
   * Cover is a move to 0) and answers the whole order. The body carries the order `version` the change is based on. A form save
   * is never retried, so it sends no Idempotency-Key. `409 edit.stale`, `404`, `422 orders.locked`.
   */
  move(
    orderId: string,
    imageId: string,
    position: number,
    version: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /**
   * `PUT /api/v1/orders/{orderId}/images/{imageId}`: sets the photo's description and answers the whole order. An empty
   * `description` (or the default text) clears the stored one, so the screen shows "Order {number} photo {position}" again.
   * The body carries the order `version` the window opened with. `400` too long, `409 edit.stale`, `404`, `422 orders.locked`.
   */
  describe(
    orderId: string,
    imageId: string,
    description: string,
    version: string,
    signal?: AbortSignal,
  ): Promise<OrderDetailResponse>;
}

const imagePath = (orderId: string, imageId: string): string =>
  `/orders/${encodeURIComponent(orderId)}/images/${encodeURIComponent(imageId)}`;

export function createOrderPhotosService(client: HttpClient): OrderPhotosService {
  return {
    rules: (signal) => client.get<ImageRulesResponse>('/orders/image-rules', { signal }),
    upload: (orderId, file, fileName, description, idempotencyKey, signal) => {
      const form = new FormData();
      form.append('file', file, fileName);
      form.append('description', description);
      return client.post<OrderDetailResponse>(`/orders/${encodeURIComponent(orderId)}/images`, form, {
        idempotencyKey,
        signal,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },
    move: (orderId, imageId, position, version, signal) =>
      client.put<OrderDetailResponse>(`${imagePath(orderId, imageId)}/position`, { position, version }, { signal }),
    describe: (orderId, imageId, description, version, signal) =>
      client.put<OrderDetailResponse>(imagePath(orderId, imageId), { description, version }, { signal }),
  };
}

export const orderPhotosService: OrderPhotosService = createOrderPhotosService(apiClient);
