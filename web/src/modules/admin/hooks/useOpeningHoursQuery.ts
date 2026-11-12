// The staff view of the weekly hours (CONT-01) and the hours save (PUB-03; plan 11-16).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import {
  openingHoursService,
  type OpeningHours,
  type UpdateOpeningHoursRequest,
} from '@/modules/admin/services/openingHoursService';

/** The key of the hours query: one week for the whole shop, so no params. */
export const openingHoursKey = ['opening-hours'] as const;

export function useOpeningHoursQuery() {
  return useQuery({
    queryKey: openingHoursKey,
    queryFn: ({ signal }) => openingHoursService.get(signal),
  });
}

/**
 * The hours save. A save that went through puts the saved week in the cache and clears the public data held in this browser, so the
 * public pages read the new hours next (the server clears its own cache itself). A refused save changes neither.
 */
export function useUpdateOpeningHours(
  options: Pick<SubmissionOptions<UpdateOpeningHoursRequest, OpeningHours>, 'onSuccess' | 'onFailure'> = {},
) {
  const queryClient = useQueryClient();
  return useSubmission<UpdateOpeningHoursRequest, OpeningHours>((_key, body) => openingHoursService.update(body), {
    onSuccess: (saved, data) => {
      queryClient.setQueryData(openingHoursKey, saved);
      invalidatePublicContent();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}
