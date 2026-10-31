// Payment method calls (plan 08-04, D-16..D-19). Types come from the generated OpenAPI types. Both roles may list; the writes are the
// Manager's. A save from a form carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type PaymentMethodListItem = Schemas['OrderListItem'];
export type PaymentMethodDetailResponse = Schemas['OrderListEntryDetailResponse'];
/** The add form: a name and a tone. The server ignores any version on an add. */
export type CreatePaymentMethodRequest = Omit<Schemas['OrderListEntryRequest'], 'version'>;
/** The edit form: a name, a tone and the row version the form was opened with. */
export type UpdatePaymentMethodRequest = Schemas['OrderListEntryRequest'];

export interface PaymentMethodsService {
  /** `GET /api/v1/payment-methods`: every payment method, retired ones included, A to Z. */
  list(signal?: AbortSignal): Promise<PaymentMethodListItem[]>;
  /**
   * `POST /api/v1/payment-methods`: adds a payment method. The caller supplies one Idempotency-Key per submission.
   * 400 `payment-methods.invalid-request` lists the field errors (a duplicate name is one), 409 `auth.session-busy` when the save lost a deadlock.
   */
  create(
    body: CreatePaymentMethodRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<PaymentMethodDetailResponse>;
  /** `GET /api/v1/payment-methods/{id}`: one payment method with its use count, who recorded and last changed it, and its row version. 404 `payment-methods.not-found`. */
  get(id: string, signal?: AbortSignal): Promise<PaymentMethodDetailResponse>;
  /**
   * `PUT /api/v1/payment-methods/{id}`: saves the form. The body carries the row version the form was opened with: 409 `edit.stale` when it is
   * not the stored one. A form edit is never retried, so it carries no Idempotency-Key (SEC-07). 400 `payment-methods.invalid-request`, 404.
   */
  update(id: string, body: UpdatePaymentMethodRequest, signal?: AbortSignal): Promise<PaymentMethodDetailResponse>;
  /** `POST /api/v1/payment-methods/{id}/retire`: hides the method from the pickers. It sends no row version; one Idempotency-Key per attempt. 404. */
  retire(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/payment-methods/{id}/reactivate`: brings a retired method back, with one Idempotency-Key per attempt. 404. */
  reactivate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/payment-methods/{id}`: removes a method no payment has ever used. No row version, no Idempotency-Key. 422 `payment-methods.in-use`, 404. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const entryPath = (id: string): string => `/payment-methods/${encodeURIComponent(id)}`;

export function createPaymentMethodsService(client: HttpClient): PaymentMethodsService {
  return {
    list: (signal) => client.get<PaymentMethodListItem[]>('/payment-methods', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<PaymentMethodDetailResponse>('/payment-methods', body, { idempotencyKey, signal }),
    get: (id, signal) => client.get<PaymentMethodDetailResponse>(entryPath(id), { signal }),
    update: (id, body, signal) => client.put<PaymentMethodDetailResponse>(entryPath(id), body, { signal }),
    retire: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/retire`, undefined, { idempotencyKey, signal }),
    reactivate: (id, idempotencyKey, signal) =>
      client.post(`${entryPath(id)}/reactivate`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(entryPath(id), { signal }),
  };
}

export const paymentMethodsService: PaymentMethodsService = createPaymentMethodsService(apiClient);
