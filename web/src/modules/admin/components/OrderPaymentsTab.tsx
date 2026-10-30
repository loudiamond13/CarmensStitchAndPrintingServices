import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderPaymentsTabProps {
  order: OrderDetailResponse;
  readOnly?: boolean | undefined;
}

export function OrderPaymentsTab(props: OrderPaymentsTabProps) {
  void props;
  return null;
}
