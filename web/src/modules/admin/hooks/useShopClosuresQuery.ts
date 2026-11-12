// The staff view of the upcoming closures (CONT-04) and the three closure writes (PUB-03; plan 11-16). A write that went through reads the list
// again and clears the public data held in this browser, so the public pages read the new closures next (the server clears its own cache
// itself). A refused write changes neither.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import {
  shopClosuresService,
  type ShopClosure,
  type ShopClosureRequest,
} from '@/modules/admin/services/shopClosuresService';

/** The key of the closures query: one list for the whole shop, so no params. */
export const shopClosuresKey = ['shop-closures'] as const;

export function useShopClosuresQuery() {
  return useQuery({
    queryKey: shopClosuresKey,
    queryFn: ({ signal }) => shopClosuresService.list(signal),
  });
}

/** Reads the closures from the server now, puts them in the cache for the list too, and gives them back (Load Latest in a closure window). */
export function useReadClosuresAgain(): () => Promise<ShopClosure[]> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.query({
      queryKey: shopClosuresKey,
      queryFn: ({ signal }) => shopClosuresService.list(signal),
      staleTime: 0,
    });
}

type WriteOptions<TData, TResult> = Pick<SubmissionOptions<TData, TResult>, 'onSuccess' | 'onFailure'>;

/** Reads the list again and clears the public data in this browser: what every successful closure write does. */
function useAfterWrite(): () => void {
  const queryClient = useQueryClient();
  return () => {
    invalidatePublicContent();
    void queryClient.invalidateQueries({ queryKey: shopClosuresKey });
  };
}

/** Adds a closure: one Idempotency-Key per submission. */
export function useCreateShopClosure(options: WriteOptions<ShopClosureRequest, ShopClosure> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<ShopClosureRequest, ShopClosure>((key, body) => shopClosuresService.create(body, key), {
    onSuccess: (saved, data) => {
      afterWrite();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}

/** What an edit sends: the closure and the form with the version it was opened with. */
export interface UpdateShopClosureData {
  id: string;
  body: ShopClosureRequest;
}

/** Saves a closure with the version its form was opened with. */
export function useUpdateShopClosure(options: WriteOptions<UpdateShopClosureData, ShopClosure> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<UpdateShopClosureData, ShopClosure>(
    (_key, { id, body }) => shopClosuresService.update(id, body),
    {
      onSuccess: (saved, data) => {
        afterWrite();
        options.onSuccess?.(saved, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/** Deletes the closure with this id. */
export function useDeleteShopClosure(options: WriteOptions<string, undefined> = {}) {
  const afterWrite = useAfterWrite();
  return useSubmission<string, undefined>(
    async (_key, id) => {
      await shopClosuresService.remove(id);
      return undefined;
    },
    {
      onSuccess: (result, data) => {
        afterWrite();
        options.onSuccess?.(result, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}
