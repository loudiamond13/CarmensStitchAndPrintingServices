// The signed-in devices list (S7, D-43). Stale at once, so it is read again on window focus and whenever the page is
// opened, never on a timer (WEB-08). The rows are put in display order: this device first, then newest activity first.
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { sessionsListKey } from '@/lib/query/keys';
import { orderDevices } from '@/modules/admin/components/deviceSummary';
import { sessionsService, type SessionListItem } from '@/modules/admin/services/sessionsService';

/** After "Sign Out Other Devices": the open list keeps only this device at once, then reads the server again. */
export function refreshAfterSignedOutOthers(queryClient: QueryClient): void {
  queryClient.setQueryData<SessionListItem[]>(sessionsListKey, (list) => list?.filter((item) => item.current));
  void queryClient.invalidateQueries({ queryKey: sessionsListKey });
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: sessionsListKey,
    queryFn: ({ signal }) => sessionsService.list(signal),
    staleTime: 0,
    select: orderDevices,
  });
}
