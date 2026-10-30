// Plan 08-10.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export function useApplyOrder(): (order: OrderDetailResponse) => void {
  return (order) => {
    void order;
  };
}
