// The upload queue of one order's photos (ORD-04, IMG-01, D-10, D-31).
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export type UploadState = 'waiting' | 'uploading' | 'failed';

export interface UploadFailure {
  reason: string;
  retryable: boolean;
}

export interface QueueItem {
  readonly id: string;
  readonly key: string;
  readonly blob: Blob;
  readonly name: string;
  readonly description: string;
  readonly preview: string | null;
  readonly previewUnavailable: boolean;
  readonly state: UploadState;
  readonly failure: UploadFailure | null;
}

export interface PreparedUpload {
  blob: Blob;
  name: string;
  description: string;
  preview: string | null;
  previewUnavailable: boolean;
}

export interface UploadDeps {
  upload(
    orderId: string,
    item: { blob: Blob; name: string; description: string; key: string },
    signal: AbortSignal,
  ): Promise<OrderDetailResponse>;
  onSaved(order: OrderDetailResponse): void;
  onLocked(message: string): void;
  onBatchDone(count: number): void;
}

export interface QueueSnapshot {
  readonly items: readonly QueueItem[];
  readonly progress: { readonly index: number; readonly total: number } | null;
  readonly pending: number;
  readonly failed: number;
  readonly batchTotal: number;
  readonly announcement: string;
}

const EMPTY: QueueSnapshot = { items: [], progress: null, pending: 0, failed: 0, batchTotal: 0, announcement: '' };

export const photoUploadQueue = {
  enqueue: (_orderId: string, _items: readonly PreparedUpload[], _deps: UploadDeps): void => undefined,
  retry: (_orderId: string, _itemId: string): void => undefined,
  remove: (_orderId: string, _itemId: string): void => undefined,
  clear: (_orderId: string): void => undefined,
  snapshot: (_orderId: string): QueueSnapshot => EMPTY,
  subscribe:
    (_listener: () => void): (() => void) =>
    () =>
      undefined,
};

export interface PhotoUploadQueueApi extends QueueSnapshot {
  enqueue(items: readonly PreparedUpload[]): void;
  retry(itemId: string): void;
  remove(itemId: string): void;
}

export function usePhotoUploadQueue(_orderId: string): PhotoUploadQueueApi {
  return { ...EMPTY, enqueue: () => undefined, retry: () => undefined, remove: () => undefined };
}
