// The Orders list toolbar (ORD-02; plan 08-09). Skeleton for the red step: the real toolbar replaces it.
import type { useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';

export interface OrdersToolbarProps {
  values: ReturnType<typeof useOrdersListParams>[0];
  set: ReturnType<typeof useOrdersListParams>[1];
}

export function OrdersToolbar(props: OrdersToolbarProps) {
  void props;
  return null;
}
