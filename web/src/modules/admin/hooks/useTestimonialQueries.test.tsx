import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  testimonialsKey,
  useCreateTestimonial,
  useDeleteTestimonial,
  useMoveTestimonial,
  useReadTestimonialsAgain,
  useSetTestimonialShown,
  useTestimonialsQuery,
  useUpdateTestimonial,
} from '@/modules/admin/hooks/useTestimonialQueries';
import type { TestimonialRequest } from '@/modules/admin/services/testimonialsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoTestimonials,
  problemAnswer,
  TESTIMONIAL_IDS,
  testimonialsBackend,
  testimonialVersionAfter,
} from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The staff read of the testimonials and their writes (CONT-03, PUB-03; plan 11-24).

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const body: TestimonialRequest = {
  quote: 'Great jerseys.',
  name: 'Juan Dela Cruz',
  teamOrRole: null,
  stars: 4,
  isShown: true,
  version: 'AAAAAAAAG01=',
};

describe('useTestimonialsQuery', () => {
  it('reads the list once under the testimonials key, every testimonial in order', async () => {
    const backend = testimonialsBackend();
    const { result } = renderHook(() => useTestimonialsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.map((item) => item.name)).toEqual([
      'Juan Dela Cruz',
      'Ana Reyes',
      'Ben Santos',
      'Carlo Mendoza',
    ]);
    expect(backend.gets).toBe(1);
    expect(testimonialsKey).toEqual(['testimonials']);
  });

  it('reports a failed read as an error', async () => {
    server.use(http.get('*/api/v1/testimonials', () => problemAnswer(500)));
    const { result } = renderHook(() => useTestimonialsQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useReadTestimonialsAgain', () => {
  it('reads the list from the server now and gives it back', async () => {
    const backend = testimonialsBackend();
    const { result } = renderHook(() => useReadTestimonialsAgain(), { wrapper });

    let list: Awaited<ReturnType<typeof result.current>> = [];
    await act(async () => {
      list = await result.current();
    });

    expect(list).toHaveLength(4);
    expect(backend.gets).toBe(1);
  });
});

describe('useCreateTestimonial', () => {
  it('adds with POST and one Idempotency-Key, reads the list again and clears the public data in this browser', async () => {
    const backend = testimonialsBackend();
    queryClient.setQueryData(testimonialsKey, []);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateTestimonial({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ ...body, version: null });
    });

    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.key).toMatch(/\S/);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryClient.getQueryState(testimonialsKey)?.isInvalidated).toBe(true);
    });
  });

  it('a refused add clears nothing and hands the failure on', async () => {
    testimonialsBackend(undefined, {
      onPost: () => problemAnswer(400, { errors: { quote: ['Enter the quote.'] } }),
    });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useCreateTestimonial({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit({ ...body, version: null });
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 400 });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('useUpdateTestimonial', () => {
  it('saves with PUT and the version, reads the list again and clears the public data', async () => {
    const backend = testimonialsBackend();
    queryClient.setQueryData(testimonialsKey, []);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateTestimonial({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.juan, body });
    });

    expect(backend.puts).toEqual([{ id: TESTIMONIAL_IDS.juan, body }]);
    expect((onSuccess.mock.calls[0]?.[0] as { version: string }).version).toBe(testimonialVersionAfter(1));
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryClient.getQueryState(testimonialsKey)?.isInvalidated).toBe(true);
    });
  });

  it('on a stale save clears nothing and hands the failure on', async () => {
    testimonialsBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUpdateTestimonial({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.juan, body });
    });

    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 409, code: 'edit.stale' });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('useMoveTestimonial, useSetTestimonialShown and useDeleteTestimonial', () => {
  it('moves with the direction and one Idempotency-Key, then clears the public data', async () => {
    const backend = testimonialsBackend();
    const { result } = renderHook(() => useMoveTestimonial(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.ana, direction: 'up' });
    });

    expect(backend.moves).toHaveLength(1);
    expect(backend.moves[0]).toMatchObject({ id: TESTIMONIAL_IDS.ana, direction: 'up' });
    expect(backend.moves[0]?.key).toMatch(/\S/);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a second move of the same testimonial the same way is a new move, not the same submission', async () => {
    const backend = testimonialsBackend();
    const { result } = renderHook(() => useMoveTestimonial(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.ben, direction: 'up' });
    });
    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.ben, direction: 'up' });
    });

    expect(backend.moves).toHaveLength(2);
    expect(backend.moves[0]?.key).not.toBe(backend.moves[1]?.key);
  });

  it('hides and shows with their own routes and clears the public data each time', async () => {
    const backend = testimonialsBackend();
    const { result } = renderHook(() => useSetTestimonialShown(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.juan, shown: false });
    });
    await act(async () => {
      await result.current.submit({ id: TESTIMONIAL_IDS.juan, shown: true });
    });

    expect(backend.hides).toEqual([TESTIMONIAL_IDS.juan]);
    expect(backend.shows).toEqual([TESTIMONIAL_IDS.juan]);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(2);
  });

  it('deletes with DELETE and clears the public data; a failed delete clears nothing', async () => {
    const backend = testimonialsBackend(demoTestimonials(), {
      onDelete: (id) => (id === TESTIMONIAL_IDS.ana ? problemAnswer(500) : undefined),
    });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useDeleteTestimonial({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(TESTIMONIAL_IDS.carlo);
    });
    expect(backend.deletes).toEqual([TESTIMONIAL_IDS.carlo]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.submit(TESTIMONIAL_IDS.ana);
    });
    expect(onFailure).toHaveBeenCalledOnce();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });
});
