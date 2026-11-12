// The staff view of the product lines (CONT-02) and their writes (PUB-03; plan 11-20). Every write that went through reads the list again
// and clears the public data held in this browser, so the public pages read the new lines next (the server clears its own cache itself).
// A refused write changes neither.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import {
  productLinesService,
  type MoveDirection,
  type ProductLineDetail,
  type ProductLineRequest,
} from '@/modules/admin/services/productLinesService';

/** The key of the list query: one list for the whole shop, so no params. */
export const productLinesKey = ['product-lines'] as const;

/** The key of one line's query. */
export const productLineKey = (id: string) => ['product-lines', id] as const;

export function useProductLineListQuery() {
  return useQuery({
    queryKey: productLinesKey,
    queryFn: ({ signal }) => productLinesService.list(signal),
  });
}

/**
 * One line for the editor. A null id (a new line, or an id that is not a GUID) asks for nothing. The line is read again every time the editor
 * opens, so the form is never filled from an old copy: its version is what a save sends.
 */
export function useProductLineQuery(id: string | null) {
  return useQuery({
    queryKey: productLineKey(id ?? ''),
    queryFn: ({ signal }) => productLinesService.get(id ?? '', signal),
    enabled: id !== null,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

type WriteOptions<TData, TResult> = Pick<SubmissionOptions<TData, TResult>, 'onSuccess' | 'onFailure'>;

/** Reads the list again and clears the public data in this browser: what every successful line write does. */
function useAfterWrite(): () => void {
  const queryClient = useQueryClient();
  return () => {
    invalidatePublicContent();
    void queryClient.invalidateQueries({ queryKey: productLinesKey, exact: true });
  };
}

/** Adds a line: one Idempotency-Key per submission. The new line is put in its own cache, so its editor opens on it at once. */
export function useCreateProductLine(options: WriteOptions<ProductLineRequest, ProductLineDetail> = {}) {
  const queryClient = useQueryClient();
  const afterWrite = useAfterWrite();
  return useSubmission<ProductLineRequest, ProductLineDetail>((key, body) => productLinesService.create(body, key), {
    onSuccess: (saved, data) => {
      queryClient.setQueryData(productLineKey(saved.id), saved);
      afterWrite();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}

/** What an edit sends: the line and the form with the version it was opened with. */
export interface UpdateProductLineData {
  id: string;
  body: ProductLineRequest;
}

/** Saves a line with the version its form was opened with; the answer goes into the line's cache. */
export function useUpdateProductLine(options: WriteOptions<UpdateProductLineData, ProductLineDetail> = {}) {
  const queryClient = useQueryClient();
  const afterWrite = useAfterWrite();
  return useSubmission<UpdateProductLineData, ProductLineDetail>(
    (_key, { id, body }) => productLinesService.update(id, body),
    {
      onSuccess: (saved, data) => {
        queryClient.setQueryData(productLineKey(saved.id), saved);
        afterWrite();
        options.onSuccess?.(saved, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/**
 * One single-click action on one row (Move, Hide, Show, Delete) through useSubmission: a double click sends one request, and a retry after a
 * failure that may have run keeps its Idempotency-Key. A finished action is a new intent the next time (the identity moves on), so moving
 * the same line the same way twice sends two moves.
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

/** What a move sends: the line and the way it goes. */
export interface MoveProductLineData {
  id: string;
  direction: MoveDirection;
}

/** Moves a line up or down one place. */
export function useMoveProductLine(options: WriteOptions<MoveProductLineData, undefined> = {}) {
  return useRowAction<MoveProductLineData>(
    (key, { id, direction }) => productLinesService.move(id, direction, key),
    options,
  );
}

/** What Hide and Show send: the line and whether it is to be shown. */
export interface SetProductLineShownData {
  id: string;
  shown: boolean;
}

/** Takes a line off the website, or puts it back. */
export function useSetProductLineShown(options: WriteOptions<SetProductLineShownData, undefined> = {}) {
  return useRowAction<SetProductLineShownData>(
    (key, { id, shown }) => (shown ? productLinesService.show(id, key) : productLinesService.hide(id, key)),
    options,
  );
}

/** Deletes the line with this id (the server refuses one that is in use). */
export function useDeleteProductLine(options: WriteOptions<string, undefined> = {}) {
  const generation = useRef(0);
  const afterWrite = useAfterWrite();
  return useSubmission<string, undefined>(
    async (_key, id) => {
      await productLinesService.remove(id);
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
