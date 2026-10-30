// The server's business today (D-59), for the order date presets and the order form's date defaults. The device clock is never
// read: the date comes from any order answer already held (a list page or an order page carries `today`), and only when none is
// held does one small list call ask for it. Held answers are read from the query cache, so the value follows the newest one.
import { notifyManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { ordersService } from '@/modules/admin/services/ordersService';

/** The one small call that asks for today when no order answer is held. */
const businessTodayKey = ['business-today'] as const;

/** The query roots whose answers carry the business `today`: order list pages and order pages. */
const ANSWER_ROOTS = [['orders'], ['order']] as const;

function todayOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('today' in data)) return null;
  return typeof data.today === 'string' && isCalendarDate(data.today) ? data.today : null;
}

/** The `today` of the most recently fetched order answer in the cache, or null when there is none. */
function newestHeldToday(client: QueryClient): string | null {
  let newest: { today: string; at: number } | null = null;
  for (const queryKey of ANSWER_ROOTS) {
    for (const query of client.getQueryCache().findAll({ queryKey })) {
      const today = todayOf(query.state.data);
      if (today !== null && (newest === null || query.state.dataUpdatedAt >= newest.at)) {
        newest = { today, at: query.state.dataUpdatedAt };
      }
    }
  }
  return newest?.today ?? null;
}

export interface BusinessTodayState {
  /** `YYYY-MM-DD` in business time, or null until it is known. */
  today: string | null;
  /** The asking call failed and no answer is held. */
  isError: boolean;
  error: unknown;
  /** Asks again after a failure. */
  refetch: () => void;
}

/**
 * The business today with its loading state. `enabled` false sends no request (a screen that needs the date only for some
 * views), but still returns a date that is already held.
 */
export function useBusinessTodayState(enabled = true): BusinessTodayState {
  const client = useQueryClient();
  // The cache announces new queries while React renders, so the announcement is deferred, as TanStack's own hooks do.
  const held = useSyncExternalStore(
    (notify) => client.getQueryCache().subscribe(notifyManager.batchCalls(notify)),
    () => newestHeldToday(client),
  );
  const probe = useQuery({
    queryKey: businessTodayKey,
    queryFn: async ({ signal }) => (await ordersService.list({ page: 1, pageSize: 1 }, signal)).today,
    enabled: enabled && held === null,
  });
  return {
    today: held ?? probe.data ?? null,
    isError: held === null && probe.isError,
    error: probe.error,
    refetch: () => {
      void probe.refetch();
    },
  };
}

/** The business today (`YYYY-MM-DD`), or null until it is known. */
export function useBusinessToday(enabled = true): string | null {
  return useBusinessTodayState(enabled).today;
}
