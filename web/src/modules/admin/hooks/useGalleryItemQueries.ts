// The staff view of the gallery (GAL-03) and its writes (PUB-03; plan 11-32). Every write that went through reads the gallery pages and the
// product lines (their shown-photo counts) again and clears the public data held in this browser, so the public Gallery reads the change
// next (the server clears its own cache itself). A refused write changes neither.
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { useListQuery } from '@/lib/query/useListQuery';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { productLinesKey } from '@/modules/admin/hooks/useProductLineQueries';
import {
  galleryItemsService,
  type GalleryAddForm,
  type GalleryItem,
  type GalleryItemPage,
  type GalleryListQuery,
  type GalleryUploadRequest,
  type MoveDirection,
} from '@/modules/admin/services/galleryItemsService';
import { listKey } from '@/lib/query/keys';

/** The first key segment of every gallery query: the pages are `['gallery-items', 'list', params]`. */
export const galleryItemsKey = ['gallery-items'] as const;

/** One page of the Manager's list: keyed on the parsed line, page and size, and keeping the rows of the page it had while the next one loads. */
export function useGalleryItemsQuery(params: GalleryListQuery) {
  return useListQuery({
    key: galleryItemsKey[0],
    params,
    fetcher: (query, signal) => galleryItemsService.list(query, signal),
  });
}

/** Reads this page from the server now, puts it in the cache for the table too, and gives it back (Load Latest in the window). */
export function useReadGalleryAgain(params: GalleryListQuery): () => Promise<GalleryItemPage> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.query({
      queryKey: listKey(galleryItemsKey[0], params),
      queryFn: ({ signal }) => galleryItemsService.list(params, signal),
      staleTime: 0,
    });
}

type WriteOptions<TData, TResult> = Pick<SubmissionOptions<TData, TResult>, 'onSuccess' | 'onFailure'>;

/** Reads the gallery pages and the lines again and clears the public data in this browser: what every successful gallery write does. */
function useAfterWrite(): () => void {
  const queryClient = useQueryClient();
  return () => {
    invalidatePublicContent();
    void queryClient.invalidateQueries({ queryKey: galleryItemsKey });
    void queryClient.invalidateQueries({ queryKey: productLinesKey, exact: true });
  };
}

/** What names a file for the retry check: a Blob is not plain data, so its name and size stand for it. */
const fileIdentity = (file: Blob, fileName: string): string => `${fileName}:${String(file.size)}`;

/** Adds a photo for older work: one Idempotency-Key per submission. */
export function useCreateGalleryUpload(options: WriteOptions<GalleryAddForm, GalleryItem> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<GalleryAddForm, GalleryItem>((key, form) => galleryItemsService.create(form, key), {
    identity: ({ file, fileName, ...fields }) => `${fileIdentity(file, fileName)}:${JSON.stringify(fields)}`,
    onSuccess: (saved, data) => {
      afterWrite();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}

/** What an edit sends: the upload and the form with the version it was opened with. */
export interface UpdateGalleryUploadData {
  id: string;
  body: GalleryUploadRequest;
}

/** Saves an upload with the version its form was opened with. */
export function useUpdateGalleryUpload(options: WriteOptions<UpdateGalleryUploadData, GalleryItem> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<UpdateGalleryUploadData, GalleryItem>(
    (_key, { id, body }) => galleryItemsService.update(id, body),
    {
      onSuccess: (saved, data) => {
        afterWrite();
        options.onSuccess?.(saved, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/** What a photo replacement sends: the upload and the prepared file. */
export interface ReplaceGalleryPhotoData {
  id: string;
  file: Blob;
  fileName: string;
}

/** Puts a new file in place of an upload's photo: one Idempotency-Key per file. The item comes back with its new version. */
export function useReplaceGalleryPhoto(options: WriteOptions<ReplaceGalleryPhotoData, GalleryItem> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<ReplaceGalleryPhotoData, GalleryItem>(
    (key, { id, file, fileName }) => galleryItemsService.replacePhoto(id, file, fileName, key),
    {
      identity: ({ id, file, fileName }) => `${id}:${fileIdentity(file, fileName)}`,
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
 * item the same way twice sends two moves.
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

/** What a move sends: the item, the way it goes and the line the list is filtered to (null for every line). */
export interface MoveGalleryItemData {
  id: string;
  direction: MoveDirection;
  lineId: string | null;
}

/** Moves an item up or down one place in the gallery order. */
export function useMoveGalleryItem(options: WriteOptions<MoveGalleryItemData, undefined> = {}) {
  return useRowAction<MoveGalleryItemData>(
    (key, { id, direction, lineId }) => galleryItemsService.move(id, direction, lineId, key),
    options,
  );
}

/** What Hide and Show send: the upload and whether it is to be shown. */
export interface SetGalleryUploadShownData {
  id: string;
  shown: boolean;
}

/** Takes an upload off the public Gallery, or puts it back. */
export function useSetGalleryUploadShown(options: WriteOptions<SetGalleryUploadShownData, undefined> = {}) {
  return useRowAction<SetGalleryUploadShownData>(
    (key, { id, shown }) => (shown ? galleryItemsService.show(id, key) : galleryItemsService.hide(id, key)),
    options,
  );
}

/** Deletes the upload with this id. */
export function useDeleteGalleryUpload(options: WriteOptions<string, undefined> = {}) {
  const generation = useRef(0);
  const afterWrite = useAfterWrite();
  return useSubmission<string, undefined>(
    async (_key, id) => {
      await galleryItemsService.remove(id);
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
