// The staff view of the testimonials (CONT-03) and their writes (PUB-03; plan 11-24). Every write that went through reads the list again and
// clears the public data held in this browser, so the Home page reads the new testimonials next (the server clears its own cache itself). A
// refused write changes neither.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import {
  testimonialsService,
  type MoveDirection,
  type Testimonial,
  type TestimonialRequest,
} from '@/modules/admin/services/testimonialsService';

/** The key of the list query: one list for the whole shop, so no params. */
export const testimonialsKey = ['testimonials'] as const;

export function useTestimonialsQuery() {
  return useQuery({
    queryKey: testimonialsKey,
    queryFn: ({ signal }) => testimonialsService.list(signal),
  });
}

/** Reads the list from the server now, puts it in the cache for the table too, and gives it back (Load Latest in the window). */
export function useReadTestimonialsAgain(): () => Promise<Testimonial[]> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.query({
      queryKey: testimonialsKey,
      queryFn: ({ signal }) => testimonialsService.list(signal),
      staleTime: 0,
    });
}

type WriteOptions<TData, TResult> = Pick<SubmissionOptions<TData, TResult>, 'onSuccess' | 'onFailure'>;

/** Reads the list again and clears the public data in this browser: what every successful testimonial write does. */
function useAfterWrite(): () => void {
  const queryClient = useQueryClient();
  return () => {
    invalidatePublicContent();
    void queryClient.invalidateQueries({ queryKey: testimonialsKey, exact: true });
  };
}

/** Adds a testimonial: one Idempotency-Key per submission. */
export function useCreateTestimonial(options: WriteOptions<TestimonialRequest, Testimonial> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<TestimonialRequest, Testimonial>((key, body) => testimonialsService.create(body, key), {
    onSuccess: (saved, data) => {
      afterWrite();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}

/** What an edit sends: the testimonial and the form with the version it was opened with. */
export interface UpdateTestimonialData {
  id: string;
  body: TestimonialRequest;
}

/** Saves a testimonial with the version its form was opened with. */
export function useUpdateTestimonial(options: WriteOptions<UpdateTestimonialData, Testimonial> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<UpdateTestimonialData, Testimonial>(
    (_key, { id, body }) => testimonialsService.update(id, body),
    {
      onSuccess: (saved, data) => {
        afterWrite();
        options.onSuccess?.(saved, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/**
 * One single-click action on one row (Move, Hide, Show) through useSubmission: a double click sends one request, and a retry after a failure
 * that may have run keeps its Idempotency-Key. A finished action is a new intent the next time (the identity moves on), so moving the same
 * testimonial the same way twice sends two moves.
 */
function useRowAction<TData extends { readonly id: string }>(
  send: (key: string, data: TData) => Promise<void>,
  options: WriteOptions<TData, undefined>,
) {
  const generation = useRef(0);
  const afterWrite = useAfterWrite();
  return useSubmission<TData, undefined>(
    async (key, data) => {
      await send(key, data);
      return undefined;
    },
    {
      identity: (data) => `${JSON.stringify(data)}:${String(generation.current)}`,
      onSuccess: (result, data) => {
        generation.current += 1;
        afterWrite();
        options.onSuccess?.(result, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/** What a move sends: the testimonial and the way it goes. */
export interface MoveTestimonialData {
  id: string;
  direction: MoveDirection;
}

/** Moves a testimonial up or down one place. */
export function useMoveTestimonial(options: WriteOptions<MoveTestimonialData, undefined> = {}) {
  return useRowAction<MoveTestimonialData>(
    (key, { id, direction }) => testimonialsService.move(id, direction, key),
    options,
  );
}

/** What Hide and Show send: the testimonial and whether it is to be shown. */
export interface SetTestimonialShownData {
  id: string;
  shown: boolean;
}

/** Takes a testimonial off the Home page, or puts it back. */
export function useSetTestimonialShown(options: WriteOptions<SetTestimonialShownData, undefined> = {}) {
  return useRowAction<SetTestimonialShownData>(
    (key, { id, shown }) => (shown ? testimonialsService.show(id, key) : testimonialsService.hide(id, key)),
    options,
  );
}

/** Deletes the testimonial with this id. */
export function useDeleteTestimonial(options: WriteOptions<string, undefined> = {}) {
  const generation = useRef(0);
  const afterWrite = useAfterWrite();
  return useSubmission<string, undefined>(
    async (_key, id) => {
      await testimonialsService.remove(id);
      return undefined;
    },
    {
      identity: (id) => `${id}:${String(generation.current)}`,
      onSuccess: (result, id) => {
        generation.current += 1;
        afterWrite();
        options.onSuccess?.(result, id);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}
