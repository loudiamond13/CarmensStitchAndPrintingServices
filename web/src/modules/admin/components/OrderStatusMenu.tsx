// Placeholder so the plan 08-19 tests fail on their assertions; replaced by the real menu in the next commit.
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export interface OrderStatusMenuProps {
  order: OrderDetailResponse;
  onMoved?: ((answer: OrderDetailResponse) => void) | undefined;
}

export function OrderStatusMenu(props: OrderStatusMenuProps): null {
  void props;
  return null;
}
