// STUB for the RED commit of plan 11-27 task 1; replaced in GREEN.
import { useQuery } from '@tanstack/react-query';
import type { OrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import type { PublicWebsiteFormValues } from '@/modules/admin/publicWebsiteSchemas';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { ProductLineOption } from '@/modules/admin/services/publicWebsiteService';

export const productLineOptionsKey = ['product-line-options'] as const;

export function useProductLineOptionsQuery(enabled = true) {
  return useQuery<ProductLineOption[]>({
    queryKey: productLineOptionsKey,
    queryFn: () => Promise.resolve([]),
    enabled,
  });
}

export interface PublicWebsiteSave {
  values: PublicWebsiteFormValues;
  version: string;
}

export interface SavePublicWebsiteOptions {
  order: OrderDetailResponse;
  onSaved: (order: OrderDetailResponse) => void;
}

export function useSavePublicWebsite(options: SavePublicWebsiteOptions): OrderChildSave<PublicWebsiteSave> {
  void options;
  throw new Error('not built');
}
