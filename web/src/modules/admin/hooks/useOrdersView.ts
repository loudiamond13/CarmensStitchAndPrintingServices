// Red-step skeleton (plan 08-11): replaced in the GREEN commit.
export const ORDERS_VIEW_KEY = 'csps-orders-view';
export type OrdersView = 'grid' | 'table';

export function resolveView(_urlView: OrdersView | null, _stored: string | null): OrdersView {
  return 'grid';
}

export function useOrdersView(
  _values: unknown,
  _set: unknown,
): { view: OrdersView; setView: (view: OrdersView) => void } {
  return {
    view: 'grid',
    setView: () => undefined,
  };
}
