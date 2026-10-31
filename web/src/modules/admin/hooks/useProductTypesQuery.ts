// The product type list the pickers and the order filter read. Read when a form opens; it changes rarely.
import { useQuery } from '@tanstack/react-query';
import { productTypesService } from '@/modules/admin/services/productTypesService';

/** The root of the product type query: invalidating it reads the list again (after a type is added, renamed or retired). */
export const productTypesKey = ['product-types'] as const;

export function useProductTypesQuery() {
  return useQuery({
    queryKey: productTypesKey,
    queryFn: ({ signal }) => productTypesService.list(signal),
  });
}
