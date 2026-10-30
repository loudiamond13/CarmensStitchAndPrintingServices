import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderExpensesTabProps {
  order: OrderDetailResponse;
  readOnly?: boolean | undefined;
}

export function OrderExpensesTab(props: OrderExpensesTabProps) {
  void props;
  return null;
}
