import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderBalanceStripProps {
  totals: OrderDetailResponse['totals'];
  status: string;
}

export function OrderBalanceStrip(props: OrderBalanceStripProps) {
  void props;
  return null;
}
