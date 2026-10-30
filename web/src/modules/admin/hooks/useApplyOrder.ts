// A write answers the whole order (RESEARCH Pattern 4, T-08-20). The order page takes that answer as it is, with the server's
// figures and the new row version, and every list that shows the order is read again. The browser works out no total.
import { useQueryClient } from '@tanstack/react-query';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export function useApplyOrder(): (order: OrderDetailResponse) => void {
  const queryClient = useQueryClient();
  const refresh = useRefreshOrders();
  return (order) => {
    queryClient.setQueryData(orderKey(order.id), order);
    void refresh();
  };
}

/** Reads one order again, for a refusal that shows the page is out of date (a lock, a removed row). */
export function useRefetchOrder(): (orderId: string) => Promise<void> {
  const queryClient = useQueryClient();
  return (orderId) => queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
}
