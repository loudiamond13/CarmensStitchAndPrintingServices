// Every order write reads the order lists, the deleted list and, because a name or color shows on orders and their counts decide
// whether Settings offers Delete, the three order list-entry lists again (RESEARCH Pattern 4; plan 08-10). Every order, item, payment,
// refund, discount and order expense write also changes the dashboard's figures and chart, and a payment, refund or order expense
// changes who holds what, so the dashboard and the staff-money and money-transfers roots are read again (D-13). The
// answer resolves once all have been asked, so a caller can move focus after the new rows are in the cache.
import { useQueryClient } from '@tanstack/react-query';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { orderExpenseCategoriesKey } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { paymentMethodsKey } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey } from '@/modules/admin/hooks/useProductTypesQuery';
import { moneyTransfersKey } from '@/modules/admin/hooks/useTransferRecipientsQuery';

/** The root of the deleted-orders queries (plan 08-20 keys its list under it). */
export const ordersDeletedKey = ['orders-deleted'] as const;

const REFRESHED_KEYS: readonly (readonly string[])[] = [
  ordersKey,
  ordersDeletedKey,
  productTypesKey,
  paymentMethodsKey,
  orderExpenseCategoriesKey,
  dashboardKey,
  staffMoneyKey,
  moneyTransfersKey,
];

export function useRefreshOrders(): () => Promise<unknown> {
  const queryClient = useQueryClient();
  return () => Promise.all(REFRESHED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
