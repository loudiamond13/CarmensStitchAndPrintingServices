// The figures an order window checks its caps against (D-95; plan 08-26). A window keeps the order version it opened with, so a stale
// save is still refused with a 409 (05 D-20). Only the figures behind the caps and hints follow the page's cache, and a check that
// fails reads the order once more before it refuses. The browser works out no total; the server still decides.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FieldValues, Resolver } from 'react-hook-form';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';

/** A read younger than this counts as current, so a blur and the Save that follows share one request. */
const SHARED_READ_MS = 1_000;

/** Reads one order now and puts it in the page cache; a read under a second old counts as current. Null when the read fails. */
export function useReadOrderNow(): (orderId: string) => Promise<OrderDetailResponse | null> {
  const queryClient = useQueryClient();
  return async (orderId) => {
    try {
      return await queryClient.query({
        queryKey: orderKey(orderId),
        queryFn: ({ signal }) => ordersService.get(orderId, signal),
        staleTime: SHARED_READ_MS,
        retry: false,
      });
    } catch {
      return null;
    }
  };
}

export interface OrderWindowFigures {
  /** The order the window shows and checks: the newest answer held for this order, else the opened one. */
  readonly current: OrderDetailResponse;
  /** The newest held answer at the moment of the call, for a check that runs outside render. */
  latest(): OrderDetailResponse;
  /** Reads the order now (see useReadOrderNow). */
  refresh(): Promise<OrderDetailResponse | null>;
}

export function useOrderWindowFigures(opened: OrderDetailResponse): OrderWindowFigures {
  const queryClient = useQueryClient();
  const readNow = useReadOrderNow();
  const held = useQuery({
    queryKey: orderKey(opened.id),
    queryFn: ({ signal }) => ordersService.get(opened.id, signal),
  });
  return {
    current: held.data ?? opened,
    latest: () => queryClient.getQueryData<OrderDetailResponse>(orderKey(opened.id)) ?? opened,
    refresh: () => readNow(opened.id),
  };
}

/** A form resolver that checks against the latest figures, and on a cap failure reads once and checks again. */
export function freshCapResolver<TInput extends FieldValues, TOutput>(options: {
  figures: OrderWindowFigures;
  resolverFor: (order: OrderDetailResponse) => Resolver<TInput, unknown, TOutput>;
  overCap: (values: TInput, order: OrderDetailResponse) => boolean;
}): Resolver<TInput, unknown, TOutput> {
  const { figures, resolverFor, overCap } = options;
  return async (values, context, resolverOptions) => {
    const held = figures.latest();
    const first = await resolverFor(held)(values, context, resolverOptions);
    if (Object.keys(first.errors).length === 0 || !overCap(values, held)) {
      return first;
    }
    const fresh = await figures.refresh();
    return fresh === null ? first : resolverFor(fresh)(values, context, resolverOptions);
  };
}
