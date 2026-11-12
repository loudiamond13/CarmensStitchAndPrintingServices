// The reads and the save behind the Public Website window of an order (GAL-03, CONT-03; plan 11-27). The line options are read again
// every time the window opens, so a line a Manager hid a moment ago is not offered. The save goes through the order window path: the
// order version, the answer set on the order page, and each failure shown where the person is looking.
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/feedback';
import { useOrderChildSave, type OrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import { toPublicWebsiteRequest, type PublicWebsiteFormValues } from '@/modules/admin/publicWebsiteSchemas';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { publicWebsiteService, type ProductLineOption } from '@/modules/admin/services/publicWebsiteService';
import type { FieldErrors } from '@/lib/forms/useSubmission';

const TOAST = PUBLIC_WEBSITE_COPY.toast;

/** The key of the line options query: one list for the whole shop. */
export const productLineOptionsKey = ['product-line-options'] as const;

/** The active product lines the window offers. Nothing is asked while the window is closed (`enabled` false). */
export function useProductLineOptionsQuery(enabled = true) {
  return useQuery<ProductLineOption[]>({
    queryKey: productLineOptionsKey,
    queryFn: ({ signal }) => publicWebsiteService.lineOptions(signal),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** What one submission carries: the checked values and the order version the window opened with. */
export interface PublicWebsiteSave {
  values: PublicWebsiteFormValues;
  version: string;
}

export interface SavePublicWebsiteOptions {
  /** The order as the window opened with it: its id for the call. */
  order: OrderDetailResponse;
  /** The save succeeded and the page already holds the answer. */
  onSaved: (order: OrderDetailResponse) => void;
  onFieldErrors?: ((errors: FieldErrors) => boolean) | undefined;
  onLatest?: ((order: OrderDetailResponse) => boolean) | undefined;
}

/** What a save did to the website: the order is shown now, taken off, or only its settings changed. */
function savedToast(wasShown: boolean, answer: OrderDetailResponse): { title: string; message: string } {
  const nowShown = answer.publicWebsite.shownOnWebsite;
  if (nowShown && !wasShown) {
    return TOAST.shown;
  }
  if (!nowShown && wasShown) {
    return TOAST.takenOff;
  }
  return { title: TOAST.saved.title, message: TOAST.saved.message(answer.number) };
}

export function useSavePublicWebsite({
  order,
  onSaved,
  onFieldErrors,
  onLatest,
}: SavePublicWebsiteOptions): OrderChildSave<PublicWebsiteSave> {
  const toast = useToast();
  return useOrderChildSave<PublicWebsiteSave>({
    orderId: order.id,
    thing: 'order',
    verb: 'updated',
    send: (_key, data) => publicWebsiteService.save(order.id, toPublicWebsiteRequest(data.values, data.version)),
    // The window shows its own toast: what the save did to the website matters more than the balance.
    quiet: true,
    onSaved: (answer) => {
      toast.show({ tone: 'success', ...savedToast(order.publicWebsite.shownOnWebsite, answer) });
      onSaved(answer);
    },
    onFieldErrors,
    onLatest,
  });
}
