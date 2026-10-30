import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderRefundsTabProps {
  order: OrderDetailResponse;
  readOnly?: boolean | undefined;
}

export function OrderRefundsTab(props: OrderRefundsTabProps) {
  void props;
  return null;
}
