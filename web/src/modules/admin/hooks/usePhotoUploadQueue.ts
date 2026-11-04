// The upload queue of one order's photos (ORD-04, IMG-01, D-10, D-31). Picked photos wait here in memory, per order id, and
// upload one at a time, each under its own Idempotency-Key. Nothing is written to browser storage (a shared shop phone must not
// show another order's photos); the queue is dropped when the Images card leaves the page.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { useToast } from '@/components/feedback';
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
import { useApplyOrder } from '@/modules/admin/hooks/useApplyOrder';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';

export type UploadState = 'waiting' | 'uploading' | 'failed';

export interface UploadFailure {
  reason: string;
  /** Try Again can succeed (network, timeout, 5xx, 409, 429); false means the server would refuse the same file again. */
  retryable: boolean;
}

export interface QueueItem {
  readonly id: string;
  /** The Idempotency-Key, fixed when the file joins the queue and reused by Try Again. */
  readonly key: string;
  /** The prepared bytes, kept so Try Again sends the same body. */
  readonly blob: Blob;
  readonly name: string;
  readonly description: string;
  readonly preview: string | null;
  readonly previewUnavailable: boolean;
  readonly state: UploadState;
  readonly failure: UploadFailure | null;
}

/** A file that passed the pick checks and `prepareImage`. */
export interface PreparedUpload {
  blob: Blob;
  name: string;
  /** Empty keeps the server's default text. */
  description: string;
  preview: string | null;
  previewUnavailable: boolean;
}

/** What the queue needs from its screen: the request and the reactions to its outcomes. */
export interface UploadDeps {
  upload(
    orderId: string,
    item: { blob: Blob; name: string; description: string; key: string },
    signal: AbortSignal,
  ): Promise<OrderDetailResponse>;
  /** A photo is saved: the order answer is taken as it is. */
  onSaved(order: OrderDetailResponse): void;
  onLocked(message: string): void;
  /** A batch ended with no failed file left; `count` photos were added. */
  onBatchDone(count: number): void;
}

export interface QueueSnapshot {
  readonly items: readonly QueueItem[];
  /** While a file uploads: its place among the batch ("Uploading photo 2 of 4"). */
  readonly progress: { readonly index: number; readonly total: number } | null;
  /** Waiting, uploading and failed files: what would be lost by leaving. */
  readonly pending: number;
  readonly failed: number;
  /** The photos the current batch has saved or failed: the "n" of the partial-failure banner. */
  readonly batchTotal: number;
  /** The polite announcement of the last upload event. */
  readonly announcement: string;
}

interface MutableItem {
  id: string;
  key: string;
  blob: Blob;
  name: string;
  description: string;
  preview: string | null;
  previewUnavailable: boolean;
  state: UploadState;
  failure: UploadFailure | null;
}

interface Entry {
  items: MutableItem[];
  /** Photos saved by the current batch; reset once the queue is empty. */
  saved: number;
  running: boolean;
  disposed: boolean;
  deps: UploadDeps;
  controller: AbortController | null;
  announcement: string;
  snapshot: QueueSnapshot;
}

const ANNOUNCE = ORDER_PHOTOS_COPY.announce;

const EMPTY: QueueSnapshot = { items: [], progress: null, pending: 0, failed: 0, batchTotal: 0, announcement: '' };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
/** How many screens show each order's queue. */
const shown = new Map<string, number>();

function build(entry: Entry): QueueSnapshot {
  const items = entry.items.map((item) => ({ ...item }));
  const failed = items.filter((item) => item.state === 'failed').length;
  const uploading = items.some((item) => item.state === 'uploading');
  return {
    items,
    progress: uploading ? { index: entry.saved + failed + 1, total: entry.saved + items.length } : null,
    pending: items.length,
    failed,
    batchTotal: entry.saved + failed,
    announcement: entry.announcement,
  };
}

function publish(entry: Entry): void {
  entry.snapshot = build(entry);
  listeners.forEach((listener) => {
    listener();
  });
}

/** Read through a call, so the checks after an await are not narrowed away by the one before it. */
function isGone(entry: Entry): boolean {
  return entry.disposed;
}

function failureOf(error: unknown): UploadFailure {
  return { reason: error instanceof Error ? error.message : '', retryable: false };
}

/** Counts the files of the batch that are done (saved or failed) and the files the batch holds. */
function batchCounts(entry: Entry): { settled: number; total: number; failed: number } {
  const failed = entry.items.filter((item) => item.state === 'failed').length;
  return { settled: entry.saved + failed, total: entry.saved + entry.items.length, failed };
}

/** What the screen reader hears when the queue goes quiet: all uploaded, or how many did not. */
function finish(entry: Entry): void {
  const { total, failed } = batchCounts(entry);
  if (entry.items.length === 0) {
    const count = entry.saved;
    entry.saved = 0;
    entry.announcement = ANNOUNCE.allUploaded;
    publish(entry);
    entry.deps.onBatchDone(count);
    return;
  }
  if (failed > 0) {
    entry.announcement = ANNOUNCE.someFailed(failed, total);
    publish(entry);
  }
}

async function pump(orderId: string, entry: Entry): Promise<void> {
  if (entry.running) return;
  entry.running = true;
  try {
    for (;;) {
      if (isGone(entry)) return;
      const item = entry.items.find((candidate) => candidate.state === 'waiting');
      if (item === undefined) break;
      item.state = 'uploading';
      item.failure = null;
      entry.controller = new AbortController();
      publish(entry);
      let answer: OrderDetailResponse | null = null;
      try {
        answer = await entry.deps.upload(
          orderId,
          { blob: item.blob, name: item.name, description: item.description, key: item.key },
          entry.controller.signal,
        );
      } catch (error) {
        if (isGone(entry)) return;
        item.state = 'failed';
        item.failure = failureOf(error);
      }
      if (isGone(entry)) return;
      if (answer !== null) {
        entry.items = entry.items.filter((candidate) => candidate !== item);
        entry.saved += 1;
        const { settled, total } = batchCounts(entry);
        if (entry.items.some((candidate) => candidate.state === 'waiting')) {
          entry.announcement = ANNOUNCE.uploaded(settled, total);
        }
        entry.deps.onSaved(answer);
      }
      publish(entry);
    }
  } finally {
    entry.running = false;
    entry.controller = null;
  }
  finish(entry);
}

function entryOf(orderId: string, deps: UploadDeps): Entry {
  const existing = entries.get(orderId);
  if (existing !== undefined) {
    existing.deps = deps;
    return existing;
  }
  const entry: Entry = {
    items: [],
    saved: 0,
    running: false,
    disposed: false,
    deps,
    controller: null,
    announcement: '',
    snapshot: EMPTY,
  };
  entries.set(orderId, entry);
  return entry;
}

/** The module store. Tests and the F1 hand-off (plan 09-21) use it directly; screens use `usePhotoUploadQueue`. */
export const photoUploadQueue = {
  /** Adds picked files after the ones already there, in pick order, and starts uploading when idle. */
  enqueue: (orderId: string, items: readonly PreparedUpload[], deps: UploadDeps): void => {
    if (items.length === 0) return;
    const entry = entryOf(orderId, deps);
    for (const item of items) {
      entry.items.push({
        id: newIdempotencyKey(),
        key: newIdempotencyKey(),
        blob: item.blob,
        name: item.name,
        description: item.description,
        preview: item.preview,
        previewUnavailable: item.previewUnavailable,
        state: 'waiting',
        failure: null,
      });
    }
    publish(entry);
    void pump(orderId, entry);
  },
  retry: (): void => undefined,
  /** Drops a waiting or failed file. An uploading file cannot be removed. */
  remove: (orderId: string, itemId: string): void => {
    const entry = entries.get(orderId);
    const item = entry?.items.find((candidate) => candidate.id === itemId);
    if (entry === undefined || item === undefined || item.state === 'uploading') return;
    entry.items = entry.items.filter((candidate) => candidate !== item);
    if (entry.items.length === 0) entry.saved = 0;
    publish(entry);
  },
  /** Drops everything for the order and cancels the upload in flight. */
  clear: (orderId: string): void => {
    const entry = entries.get(orderId);
    if (entry === undefined) return;
    entry.disposed = true;
    entry.controller?.abort();
    entries.delete(orderId);
    listeners.forEach((listener) => {
      listener();
    });
  },
  snapshot: (orderId: string): QueueSnapshot => {
    return entries.get(orderId)?.snapshot ?? EMPTY;
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /**
   * A screen shows this order's queue; the returned function says it is gone. The queue is dropped once the last screen has
   * left, unless one shows it again straight away (a StrictMode remount).
   */
  show: (orderId: string): (() => void) => {
    shown.set(orderId, (shown.get(orderId) ?? 0) + 1);
    return () => {
      shown.set(orderId, (shown.get(orderId) ?? 1) - 1);
      // Only the queue that was there when the screen left is dropped, not one made since.
      const leaving = entries.get(orderId);
      window.setTimeout(() => {
        if ((shown.get(orderId) ?? 0) <= 0) {
          shown.delete(orderId);
          if (entries.get(orderId) === leaving) photoUploadQueue.clear(orderId);
        }
      }, 0);
    };
  },
};

export interface PhotoUploadQueueApi extends QueueSnapshot {
  enqueue: (items: readonly PreparedUpload[]) => void;
  retry: (itemId: string) => void;
  remove: (itemId: string) => void;
}

/** The order's queue for the Images card: its snapshot and the actions, with the request and the order cache wired in. */
export function usePhotoUploadQueue(orderId: string): PhotoUploadQueueApi {
  const applyOrder = useApplyOrder();
  const queryClient = useQueryClient();
  const toast = useToast();
  const snapshot = useSyncExternalStore(
    photoUploadQueue.subscribe,
    () => photoUploadQueue.snapshot(orderId),
    () => EMPTY,
  );
  useEffect(() => photoUploadQueue.show(orderId), [orderId]);
  const deps: UploadDeps = {
    upload: (id, item, signal) =>
      orderPhotosService.upload(id, item.blob, item.name, item.description, item.key, signal),
    onSaved: applyOrder,
    onLocked: () => undefined,
    onBatchDone: (count) => {
      const number = queryClient.getQueryData<OrderDetailResponse>(orderKey(orderId))?.number ?? '';
      toast.show({
        tone: 'success',
        title: ORDER_PHOTOS_COPY.toasts.added.title,
        message: ORDER_PHOTOS_COPY.toasts.added.message(count, number),
      });
    },
  };
  return {
    ...snapshot,
    enqueue: (items) => {
      photoUploadQueue.enqueue(orderId, items, deps);
    },
    retry: (itemId) => {
      photoUploadQueue.retry(orderId, itemId);
    },
    remove: (itemId) => {
      photoUploadQueue.remove(orderId, itemId);
    },
  };
}
