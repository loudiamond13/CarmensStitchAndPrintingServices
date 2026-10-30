// Stub for the RED step of plan 08-22: the real dialog follows in the GREEN commit.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface DeleteOrderCounts {
  items: number;
  payments: number;
  discounts: number;
  expenses: number;
  refunds?: number;
}

export function softDeleteSentence(_counts: DeleteOrderCounts): string {
  return '';
}

export interface DeleteOrderDialogProps {
  order: OrderDetailResponse;
  open: boolean;
  onClose: () => void;
}

export function DeleteOrderDialog(_props: DeleteOrderDialogProps) {
  return null;
}
