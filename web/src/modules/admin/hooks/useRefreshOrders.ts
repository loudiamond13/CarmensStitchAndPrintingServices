// Plan 08-10.
export const ordersDeletedKey = ['orders-deleted'] as const;

export function useRefreshOrders(): () => Promise<unknown> {
  return () => Promise.resolve();
}
