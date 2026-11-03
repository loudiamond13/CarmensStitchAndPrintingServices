import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { photoUploadQueue, usePhotoUploadQueue, type PreparedUpload } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { server } from '@/test/msw';
import { buildOrderDetail, order0148, orderImage } from '@/test/orderFixtures';

// The memory-only upload queue of one order (ORD-04, IMG-01, D-31): one request at a time, one key per file.

const ORDER_ID = order0148.id;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  photoUploadQueue.clear(ORDER_ID);
  queryClient.clear();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function prepared(name = 'front.jpg'): PreparedUpload {
  return {
    blob: new Blob(['jpeg bytes'], { type: 'image/jpeg' }),
    name,
    description: '',
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
  };
}

describe('usePhotoUploadQueue (tracer)', () => {
  it('uploads one prepared photo under a UUID key, sets the order from the answer, refreshes the lists and empties the queue', async () => {
    const saved = buildOrderDetail({ images: [orderImage(1)] });
    const keys: (string | null)[] = [];
    server.use(
      http.post('*/api/v1/orders/:id/images', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json(saved);
      }),
    );
    queryClient.setQueryData([...ordersKey, { page: 1 }], { held: true });
    const { result } = renderHook(() => usePhotoUploadQueue(ORDER_ID), { wrapper });

    act(() => {
      result.current.enqueue([prepared()]);
    });
    expect(result.current.items).toHaveLength(1);

    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
    });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(UUID);
    expect(queryClient.getQueryData(orderKey(ORDER_ID))).toEqual(saved);
    expect(queryClient.getQueryState([...ordersKey, { page: 1 }])?.isInvalidated).toBe(true);
  });
});
