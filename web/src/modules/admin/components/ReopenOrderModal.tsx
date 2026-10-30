// Placeholder so the plan 08-19 tests fail on their assertions; replaced by the real window in the next commit.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

export interface ReopenOrderModalProps {
  order: OrderDetailResponse;
  open: boolean;
  onClose: () => void;
  onReopened?: ((answer: OrderDetailResponse) => void) | undefined;
}

export function reopenDefault(order: Pick<OrderDetailResponse, 'status' | 'statusHistory'>): OrderStatus {
  void order;
  return 'pending';
}

export function ReopenOrderModal(props: ReopenOrderModalProps): null {
  void props;
  return null;
}
