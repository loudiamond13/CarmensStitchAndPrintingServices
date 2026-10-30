import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderStatusHistoryProps {
  history: OrderDetailResponse['statusHistory'];
}

export function OrderStatusHistory(props: OrderStatusHistoryProps) {
  void props;
  return null;
}
