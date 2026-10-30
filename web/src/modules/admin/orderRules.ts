// What an order allows (plan 08-10).
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

type RuledOrder = Pick<OrderDetailResponse, 'status' | 'totals' | 'items' | 'refunds'>;

export const isLocked = (order: RuledOrder): boolean => order.status === '';
export const canEditOrder = (order: RuledOrder): boolean => order.status === '';
export const showRefundsTab = (order: RuledOrder): boolean => order.status === '';
export const refundCap = (order: RuledOrder, savedAmount?: number | string | null): string =>
  `${order.status}${String(savedAmount)}`;
export const canAddPayment = (order: RuledOrder): boolean => order.status === '';
export const canComplete = (order: RuledOrder): boolean => order.status === '';
export const canDeleteItem = (order: RuledOrder): boolean => order.status === '';
