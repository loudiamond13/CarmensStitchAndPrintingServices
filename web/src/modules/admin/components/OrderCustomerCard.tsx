import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderCustomerCardProps {
  order: OrderDetailResponse;
  readOnly?: boolean | undefined;
}

export function OrderCustomerCard(props: OrderCustomerCardProps) {
  void props;
  return null;
}
