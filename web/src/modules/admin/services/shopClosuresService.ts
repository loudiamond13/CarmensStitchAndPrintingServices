// Shop closure calls (WEB-04). Types come from the generated OpenAPI types (D-16). All four are the Manager's. A save from a form carries the
// row version and no Idempotency-Key (SEC-07); the POST carries one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ShopClosure = Schemas['ShopClosureDto'];
/** The closure form as the API takes it: the days as "yyyy-MM-dd", the note, and the version (an edit only). */
export type ShopClosureRequest = Schemas['ShopClosureRequest'];

export interface ShopClosuresService {
  /** `GET /api/v1/shop-closures`: the closures whose last day is today or later, by first day, each with its version. */
  list(signal?: AbortSignal): Promise<ShopClosure[]>;
  /**
   * `POST /api/v1/shop-closures`: adds a closure. The caller supplies one Idempotency-Key per submission. 400 lists the field errors
   * (an overlap is one, under `firstDay`), 409 when the save lost a deadlock.
   */
  create(body: ShopClosureRequest, idempotencyKey: string, signal?: AbortSignal): Promise<ShopClosure>;
  /**
   * `PUT /api/v1/shop-closures/{id}`: saves the form. The body carries the version the form was opened with: 409 `edit.stale` when it is
   * not the stored one. A form edit is never retried, so it carries no Idempotency-Key. 400 lists the field errors, 404 when it is gone.
   */
  update(id: string, body: ShopClosureRequest, signal?: AbortSignal): Promise<ShopClosure>;
  /** `DELETE /api/v1/shop-closures/{id}`: removes a closure. No version, no Idempotency-Key. 404 `shop-closures.not-found` when it is gone. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const closurePath = (id: string): string => `/shop-closures/${encodeURIComponent(id)}`;

export function createShopClosuresService(client: HttpClient): ShopClosuresService {
  return {
    list: (signal) => client.get<ShopClosure[]>('/shop-closures', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<ShopClosure>('/shop-closures', body, { idempotencyKey, signal }),
    update: (id, body, signal) => client.put<ShopClosure>(closurePath(id), body, { signal }),
    remove: (id, signal) => client.delete(closurePath(id), { signal }),
  };
}

export const shopClosuresService: ShopClosuresService = createShopClosuresService(apiClient);
