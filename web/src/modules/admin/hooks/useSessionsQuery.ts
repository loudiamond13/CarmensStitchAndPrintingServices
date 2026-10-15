// The signed-in devices list (S7, D-43). Stale at once, so it is read again on window focus and whenever the page is
// opened, never on a timer (WEB-08). The rows are put in display order: this device first, then newest activity first.
import { useQuery } from '@tanstack/react-query';
import { sessionsListKey } from '@/lib/query/keys';
import { orderDevices } from '@/modules/admin/components/deviceSummary';
import { sessionsService } from '@/modules/admin/services/sessionsService';

export function useSessionsQuery() {
  return useQuery({
    queryKey: sessionsListKey,
    queryFn: ({ signal }) => sessionsService.list(signal),
    staleTime: 0,
    select: orderDevices,
  });
}
