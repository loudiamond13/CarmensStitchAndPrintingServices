// Product type calls (plan 08-04, D-16..D-19). Types come from the generated OpenAPI types. Both roles may list; the writes are the
// Manager's. A save from a form carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type ProductTypeListItem = Schemas['OrderListItem'];
export type ProductTypeDetailResponse = Schemas['OrderListEntryDetailResponse'];
/** The add form: a name and a tone. The server ignores any version on an add. */
export type CreateProductTypeRequest = Omit<Schemas['OrderListEntryRequest'], 'version'>;
/** The edit form: a name, a tone and the row version the form was opened with. */
export type UpdateProductTypeRequest = Schemas['OrderListEntryRequest'];

export interface ProductTypesService {
  /** `GET /api/v1/product-types`: every product type, retired ones included, A to Z. */
  list(signal?: AbortSignal): Promise<ProductTypeListItem[]>;
  /**
   * `POST /api/v1/product-types`: adds a product type. The caller supplies one Idempotency-Key per submission.
   * 400 `product-types.invalid-request` lists the field errors (a duplicate name is one), 409 `auth.session-busy` when the save lost a deadlock.
   */
  create(
    body: CreateProductTypeRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ProductTypeDetailResponse>;
  /** `GET /api/v1/product-types/{id}`: one product type with its use count, who recorded and last changed it, and its row version. 404 `product-types.not-found`. */
  get(id: string, signal?: AbortSignal): Promise<ProductTypeDetailResponse>;
  /**
   * `PUT /api/v1/product-types/{id}`: saves the form. The body carries the row version the form was opened with: 409 `edit.stale` when it is
   * not the stored one. A form edit is never retried, so it carries no Idempotency-Key (SEC-07). 400 `product-types.invalid-request`, 404.
   */
  update(id: string, body: UpdateProductTypeRequest, signal?: AbortSignal): Promise<ProductTypeDetailResponse>;
  /** `POST /api/v1/product-types/{id}/retire`: hides the type from the pickers. It sends no row version; one Idempotency-Key per attempt. 404. */
  retire(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/product-types/{id}/reactivate`: brings a retired type back, with one Idempotency-Key per attempt. 404. */
  reactivate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/product-types/{id}`: removes a type no item has ever used. No row version, no Idempotency-Key. 422 `product-types.in-use`, 404. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const entryPath = (id: string): string => `/product-types/${encodeURIComponent(id)}`;

export function createProductTypesService(client: HttpClient): ProductTypesService {
  return {
    list: (signal) => client.get<ProductTypeListItem[]>('/product-types', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<ProductTypeDetailResponse>('/product-types', body, { idempotencyKey, signal }),
    get: (id, signal) => client.get<ProductTypeDetailResponse>(entryPath(id), { signal }),
    update: (id, body, signal) => client.put<ProductTypeDetailResponse>(entryPath(id), body, { signal }),
    retire: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/retire`, undefined, { idempotencyKey, signal }),
    reactivate: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/reactivate`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(entryPath(id), { signal }),
  };
}

export const productTypesService: ProductTypesService = createProductTypesService(apiClient);
