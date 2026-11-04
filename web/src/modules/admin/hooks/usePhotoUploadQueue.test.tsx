import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
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

/** A ProblemDetails answer: the title is the generic words of the status, the message the server wrote is the detail. */
function httpFailure(
  status: number,
  code: string | undefined,
  detail: string | undefined,
  traceId?: string,
): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'Generic status words.',
      status,
      detail,
      instance: undefined,
      traceId,
      code,
      errors: {},
    },
  });
}

/** Uploads one file against held deps and fails it with `error`; returns the failed item. */
async function failOne(error: Error) {
  const { deps, held } = heldDeps();
  photoUploadQueue.enqueue(ORDER_ID, names('1.jpg'), deps);
  await waitFor(() => {
    expect(held).toHaveLength(1);
  });
  held[0]?.reject(error);
  await waitFor(() => {
    expect(photoUploadQueue.snapshot(ORDER_ID).items[0]?.state).toBe('failed');
  });
  return photoUploadQueue.snapshot(ORDER_ID).items[0];
}

describe('why an upload failed, and whether Try Again can help (D-10)', () => {
  const NETWORK = "Couldn't upload. Check your connection, then try again.";

  it.each([
    ['a lost connection', new HttpError({ kind: 'network' }), true, NETWORK],
    ['a timeout', new HttpError({ kind: 'timeout' }), true, NETWORK],
    [
      'a photo store that did not take the file',
      httpFailure(503, 'images.storage-failed', "The photo couldn't be saved. Try again."),
      true,
      "The photo couldn't be saved. Try again.",
    ],
    [
      'a server error',
      httpFailure(500, undefined, 'Something went wrong. Reference: abc123', 'abc123'),
      true,
      'Something went wrong. Reference: abc123',
    ],
    [
      'a server error with no detail',
      httpFailure(500, undefined, undefined, 'abc123'),
      true,
      'Something went wrong. Reference: abc123',
    ],
    [
      'a busy order',
      httpFailure(409, 'orders.busy', 'The order is busy. Try again.'),
      true,
      'The order is busy. Try again.',
    ],
    [
      'too many uploads',
      httpFailure(429, undefined, 'Too many requests.'),
      true,
      'Too many uploads right now. Wait a minute, then try again.',
    ],
    [
      'a host with no photo store',
      httpFailure(503, 'images.not-configured', "Photo uploads aren't set up yet."),
      false,
      "Photo uploads aren't set up yet.",
    ],
    [
      'a type the server refuses',
      httpFailure(400, 'images.type', "a.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
      false,
      "a.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.",
    ],
    [
      'a file that is too large',
      httpFailure(400, 'images.too-large', 'a.jpg is over 10 MB. Choose a smaller photo.'),
      false,
      'a.jpg is over 10 MB. Choose a smaller photo.',
    ],
    [
      'a photo with too many pixels',
      httpFailure(400, 'images.too-big', 'a.jpg is too big. Photos can be at most 25 megapixels.'),
      false,
      'a.jpg is too big. Photos can be at most 25 megapixels.',
    ],
    [
      'an order that is full',
      httpFailure(422, 'orders.images-full', 'This order already has 5 photos.'),
      false,
      'This order already has 5 photos.',
    ],
    [
      'an order that was deleted',
      httpFailure(404, 'orders.not-found', 'This order was not found or was deleted.'),
      false,
      'This order was not found or was deleted.',
    ],
  ])('marks %s', async (_label, error, retryable, reason) => {
    const item = await failOne(error);

    expect(item?.failure).toEqual({ reason, retryable });
  });
});

describe('Try Again (SEC-06, WEB-09)', () => {
  it('sends the same key and the same bytes again, and the photo is stored once', async () => {
    const sent: { key: string; form: FormData }[] = [];
    const saved = buildOrderDetail({ images: [orderImage(1)] });
    const onSaved = vi.fn();
    const deps: UploadDeps = {
      // The same form the service builds, so the two request bodies can be compared.
      upload: (_id, item) => {
        const form = new FormData();
        form.append('file', item.blob, item.name);
        form.append('description', item.description);
        sent.push({ key: item.key, form });
        return sent.length === 1 ? Promise.reject(new HttpError({ kind: 'network' })) : Promise.resolve(saved);
      },
      onSaved,
      onLocked: vi.fn(),
      onBatchDone: vi.fn(),
    };

    photoUploadQueue.enqueue(ORDER_ID, [prepared('front.jpg')], deps);
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items[0]?.state).toBe('failed');
    });
    photoUploadQueue.retry(ORDER_ID, photoUploadQueue.snapshot(ORDER_ID).items[0]?.id ?? '');
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    });

    const [first, second] = sent;
    expect(sent).toHaveLength(2);
    expect(second?.key).toBe(first?.key);
    const part = (request: typeof first) => request?.form.get('file') as File;
    expect(part(second).name).toBe(part(first).name);
    expect(await part(second).text()).toBe(await part(first).text());
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('sends one request when Try Again is pressed twice', async () => {
    const { deps, held } = heldDeps();
    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    held[0]?.reject(new HttpError({ kind: 'network' }));
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items[0]?.state).toBe('failed');
    });
    const id = photoUploadQueue.snapshot(ORDER_ID).items[0]?.id ?? '';

    photoUploadQueue.retry(ORDER_ID, id);
    photoUploadQueue.retry(ORDER_ID, id);

    await waitFor(() => {
      expect(held).toHaveLength(2);
    });
    expect(held).toHaveLength(2);
  });

  it('does not retry a failure the server would refuse again', async () => {
    const { deps, held } = heldDeps();
    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    held[0]?.reject(httpFailure(400, 'images.type', 'x'));
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items[0]?.state).toBe('failed');
    });

    photoUploadQueue.retry(ORDER_ID, photoUploadQueue.snapshot(ORDER_ID).items[0]?.id ?? '');

    expect(photoUploadQueue.snapshot(ORDER_ID).items[0]?.state).toBe('failed');
    expect(held).toHaveLength(1);
  });
});

describe('a batch with a failure (D-10, UIC-15)', () => {
  it('keeps the failed file, counts it for the banner, and toasts only when none is left', async () => {
    const { deps, held, onBatchDone } = heldDeps();
    const saved = buildOrderDetail({ images: [orderImage(1)] });

    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg', '3.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    held[0]?.resolve(saved);
    await waitFor(() => {
      expect(held).toHaveLength(2);
    });
    held[1]?.reject(new HttpError({ kind: 'network' }));
    await waitFor(() => {
      expect(held).toHaveLength(3);
    });
    held[2]?.resolve(saved);
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).progress).toBeNull();
    });

    const after = photoUploadQueue.snapshot(ORDER_ID);
    expect(after.items.map((item) => item.name)).toEqual(['2.jpg']);
    expect(after.failed).toBe(1);
    expect(after.batchTotal).toBe(3);
    expect(after.announcement).toBe("1 of 3 photos didn't upload.");
    expect(onBatchDone).not.toHaveBeenCalled();

    photoUploadQueue.retry(ORDER_ID, after.items[0]?.id ?? '');
    await waitFor(() => {
      expect(held).toHaveLength(4);
    });
    held[3]?.resolve(saved);
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    });
    expect(onBatchDone).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('drops a failed file on Remove, and the banner count goes with it', async () => {
    const { deps, held, onBatchDone } = heldDeps();
    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    held[0]?.reject(new HttpError({ kind: 'network' }));
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).failed).toBe(1);
    });

    photoUploadQueue.remove(ORDER_ID, photoUploadQueue.snapshot(ORDER_ID).items[0]?.id ?? '');

    expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    expect(photoUploadQueue.snapshot(ORDER_ID).failed).toBe(0);
    expect(onBatchDone).not.toHaveBeenCalled();
  });

  it('cannot remove the file that is uploading', async () => {
    const { deps, held } = heldDeps();
    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });

    photoUploadQueue.remove(ORDER_ID, photoUploadQueue.snapshot(ORDER_ID).items[0]?.id ?? '');

    expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(1);
  });
});

describe('an order that locked meanwhile (UIC-19)', () => {
  it('tells the screen once, fails the waiting files with the server text, and uploads nothing more', async () => {
    const { deps, held, onLocked } = heldDeps();
    const message = 'This order is completed. Reopen it to make changes.';

    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg', '3.jpg'), deps);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    held[0]?.reject(httpFailure(422, 'orders.locked', message));
    await waitFor(() => {
      expect(photoUploadQueue.snapshot(ORDER_ID).progress).toBeNull();
    });

    const items = photoUploadQueue.snapshot(ORDER_ID).items;
    expect(items.map((item) => item.state)).toEqual(['failed', 'failed', 'failed']);
    expect(items.every((item) => item.failure?.reason === message && !item.failure.retryable)).toBe(true);
    expect(onLocked).toHaveBeenCalledExactlyOnceWith(message);
    expect(held).toHaveLength(1);
  });
});

describe('the queue is memory only (SEC prohibition, IMG-05)', () => {
  it('drops everything and cancels the upload in flight when the card leaves the page', async () => {
    const { deps, held } = heldDeps();
    const signals: AbortSignal[] = [];
    const watched: UploadDeps = {
      ...deps,
      upload: (id, item, signal) => {
        signals.push(signal);
        return deps.upload(id, item, signal);
      },
    };
    photoUploadQueue.enqueue(ORDER_ID, names('1.jpg', '2.jpg'), watched);
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });

    photoUploadQueue.clear(ORDER_ID);

    expect(signals[0]?.aborted).toBe(true);
    expect(photoUploadQueue.snapshot(ORDER_ID).items).toHaveLength(0);
    held[0]?.reject(new HttpError({ kind: 'aborted' }));
    expect(held).toHaveLength(1);
  });
});
