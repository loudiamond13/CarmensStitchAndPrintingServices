import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderDiscountsTabProps {
  order: OrderDetailResponse;
  readOnly?: boolean | undefined;
}

export function OrderDiscountsTab(props: OrderDiscountsTabProps) {
  void props;
  return null;
}
