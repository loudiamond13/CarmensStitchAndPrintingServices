import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import {
  photoUploadQueue,
  usePhotoUploadQueue,
  type PreparedUpload,
  type UploadDeps,
} from '@/modules/admin/hooks/usePhotoUploadQueue';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import { buildOrderDetail, order0148, orderImage, type OrderDetailFixture } from '@/test/orderFixtures';

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
    const upload = vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(saved);
    queryClient.setQueryData([...ordersKey, { page: 1 }], { held: true });
    const { result } = renderHook(() => usePhotoUploadQueue(ORDER_ID), { wrapper });

    act(() => {
      result.current.enqueue([prepared()]);
    });
    expect(result.current.items).toHaveLength(1);

    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[4]).toMatch(UUID);
    expect(queryClient.getQueryData(orderKey(ORDER_ID))).toEqual(saved);
    expect(queryClient.getQueryState([...ordersKey, { page: 1 }])?.isInvalidated).toBe(true);
  });
});

interface Held {
  name: string;
  resolve: (order: OrderDetailFixture) => void;
  reject: (error: unknown) => void;
}

/** Deps whose uploads wait until the test settles them, recording how many run at once. */
function heldDeps() {
  const held: Held[] = [];
  const state = { inFlight: 0, maxInFlight: 0 };
  const onSaved = vi.fn();
  const onLocked = vi.fn();
  const onBatchDone = vi.fn();
  const deps: UploadDeps = {
    upload: (_orderId, item) => {
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      return new Promise((resolve, reject) => {
        held.push({
          name: item.name,
          resolve: (order) => {
            state.inFlight -= 1;
            resolve(order);
          },
          reject: (error) => {
            state.inFlight -= 1;
            reject(error instanceof Error ? error : new Error('failed'));
          },
        });
      });
    },
    onSaved,
    onLocked,
    onBatchDone,
  };
  return { deps, held, state, onSaved, onLocked, onBatchDone };
}

/** The distinct values `pick` reads from the order's queue after each change. */
function watch<T>(pick: (queue: ReturnType<typeof photoUploadQueue.snapshot>) => T | null): T[] {
  const seen: T[] = [];
  photoUploadQueue.subscribe(() => {
    const value = pick(photoUploadQueue.snapshot(ORDER_ID));
    if (value !== null && seen.at(-1) !== value) seen.push(value);
  });
  return seen;
}

function names(...labels: string[]): PreparedUpload[] {
  return labels.map((label) => prepared(label));
}

describe('a batch of photos (IMG-05, D-31)', () => {
  it('uploads in pick order, one request at a time, counting 1 of 4 to 4 of 4 and announcing each one', async () => {
    const { deps, held, state, onBatchDone } = heldDeps();
    const saved = buildOrderDetail({ images: [orderImage(1)] });
    const counts = watch((queue) =>
      queue.progress === null ? null : `${String(queue.progress.index)} of ${String(queue.progress.total)}`,
    );
    const spoken = watch((queue) => (queue.announcement === '' ? null : queue.announcement));

    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg', '3.jpg', '4.jpg'), deps);
    for (let index = 0; index < 4; index += 1) {
      await waitFor(() => {
        expect(held).toHaveLength(index + 1);
      });
      held[index]?.resolve(saved);
    }
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    });

    expect(held.map((upload) => upload.name)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg']);
    expect(state.maxInFlight).toBe(1);
    expect(counts).toEqual(['1 of 4', '2 of 4', '3 of 4', '4 of 4']);
    expect(spoken).toEqual([
      'Photo 1 of 4 uploaded.',
      'Photo 2 of 4 uploaded.',
      'Photo 3 of 4 uploaded.',
      'All photos uploaded.',
    ]);
    expect(onBatchDone).toHaveBeenCalledExactlyOnceWith(4);
  });

  it('grows the count when more photos are picked during the batch, with still one request at a time', async () => {
    const { deps, held, state, onBatchDone } = heldDeps();
    const saved = buildOrderDetail({ images: [orderImage(1)] });

    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg', '3.jpg', '4.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    photoUploadQueue.enqueue(ORDER_ID, names('5.jpg', '6.jpg'), deps);

    expect(photoUploadQueue.snapshot(ORDER_ID).progress).toEqual({ index: 1, total: 6 });
    for (let index = 0; index < 6; index += 1) {
      await waitFor(() => {
        expect(held).toHaveLength(index + 1);
      });
      held[index]?.resolve(saved);
    }
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    });

    expect(state.maxInFlight).toBe(1);
    expect(held.map((upload) => upload.name)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg']);
    expect(onBatchDone).toHaveBeenCalledExactlyOnceWith(6);
  });

  it('shows the file waiting behind the one that uploads', async () => {
    const { deps, held } = heldDeps();

    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });

    expect(photoUploadQueue.snapshot(ORDER_ID).items.map((item) => item.state)).toEqual(['uploading', 'waiting']);
  });
});
