// The payment method list the payment form reads. Read when a form opens; it changes rarely.
import { useQuery } from '@tanstack/react-query';
import { paymentMethodsService } from '@/modules/admin/services/paymentMethodsService';

/** The root of the payment method query: invalidating it reads the list again (after a method is added, renamed or retired). */
export const paymentMethodsKey = ['payment-methods'] as const;

export function usePaymentMethodsQuery() {
  return useQuery({
    queryKey: paymentMethodsKey,
    queryFn: ({ signal }) => paymentMethodsService.list(signal),
  });
}
