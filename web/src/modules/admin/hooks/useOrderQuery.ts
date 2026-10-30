// One order's detail for the order page (ORD-07). Its own root `['order', id]`, so a list invalidation does not read it again and
// the business-today lookup can find its `today`. The page is long-lived: it keeps the default cache time, refetches on window
// focus (WEB-08) and takes the server's answer after every write (useApplyOrder). A form never reads its version from here; it
// keeps the one it was opened with, so a stale save is refused with a 409 (05 D-20).
import { useQuery } from '@tanstack/react-query';
import { ordersService } from '@/modules/admin/services/ordersService';

export const orderKey = (id: string) => ['order', id] as const;

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => ordersService.get(id, signal),
  });
}
