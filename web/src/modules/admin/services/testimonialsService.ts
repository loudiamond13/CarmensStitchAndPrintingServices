// Testimonial calls (WEB-04, CONT-03). Types come from the generated OpenAPI types (D-16). All seven are the Manager's. A save from a form carries
// the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

/** One testimonial as the Manager's list reads it: shown and hidden ones, in display order, each with its version. */
export type Testimonial = Schemas['TestimonialDto'];
/** The testimonial form as the API takes it: the words, the stars, whether it shows and, for an edit, the version. */
export type TestimonialRequest = Schemas['TestimonialRequest'];
/** Which way a move goes. */
export type MoveDirection = 'up' | 'down';

export interface TestimonialsService {
  /** `GET /api/v1/testimonials`: every testimonial in display order, hidden ones included, each with its version. */
  list(signal?: AbortSignal): Promise<Testimonial[]>;
  /**
   * `POST /api/v1/testimonials`: adds a testimonial at the end. The caller supplies one Idempotency-Key per submission. 400 lists the field
   * errors, 409 when the save lost a deadlock.
   */
  create(body: TestimonialRequest, idempotencyKey: string, signal?: AbortSignal): Promise<Testimonial>;
  /**
   * `PUT /api/v1/testimonials/{id}`: saves the form. The body carries the version the form was opened with: 409 `edit.stale` when it is not the
   * stored one. A form edit is never retried, so it carries no Idempotency-Key. 400 lists the field errors, 404 when it is gone.
   */
  update(id: string, body: TestimonialRequest, signal?: AbortSignal): Promise<Testimonial>;
  /** `POST /api/v1/testimonials/{id}/move`: swaps the testimonial with the next one in the list, one Idempotency-Key per attempt. 404. */
  move(id: string, direction: MoveDirection, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/testimonials/{id}/hide`: takes the testimonial off the Home page. One Idempotency-Key per attempt. 404. */
  hide(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/testimonials/{id}/show`: lets the testimonial show on the Home page. One Idempotency-Key per attempt. 404. */
  show(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `DELETE /api/v1/testimonials/{id}`: removes the testimonial for good. No version, no Idempotency-Key. 404 when it is gone. */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

const testimonialPath = (id: string): string => `/testimonials/${encodeURIComponent(id)}`;

export function createTestimonialsService(client: HttpClient): TestimonialsService {
  return {
    list: (signal) => client.get<Testimonial[]>('/testimonials', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<Testimonial>('/testimonials', body, { idempotencyKey, signal }),
    update: (id, body, signal) => client.put<Testimonial>(testimonialPath(id), body, { signal }),
    move: (id, direction, idempotencyKey, signal) =>
      client.post(`${testimonialPath(id)}/move`, { direction }, { idempotencyKey, signal }),
    hide: (id, idempotencyKey, signal) =>
      client.post(`${testimonialPath(id)}/hide`, undefined, { idempotencyKey, signal }),
    show: (id, idempotencyKey, signal) =>
      client.post(`${testimonialPath(id)}/show`, undefined, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(testimonialPath(id), { signal }),
  };
}

export const testimonialsService: TestimonialsService = createTestimonialsService(apiClient);
