// The people who can be named as the payer (CEXP-05, D-32). Read when a form with a Paid by picker opens.
import { useQuery } from '@tanstack/react-query';
import { staffService } from '@/modules/admin/services/staffService';

/** The key of the staff lookup query. */
export const staffLookupKey = ['staff'] as const;

export function useStaffLookupQuery() {
  return useQuery({
    queryKey: staffLookupKey,
    queryFn: ({ signal }) => staffService.list(signal),
  });
}
