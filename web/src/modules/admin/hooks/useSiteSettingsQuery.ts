// The staff view of the site settings (CONT-01) and the Business Info save (PUB-03; plan 11-12).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSubmission, type SubmissionOptions } from '@/lib/forms/useSubmission';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import {
  siteSettingsService,
  type SiteSettings,
  type UpdateSiteSettingsRequest,
} from '@/modules/admin/services/siteSettingsService';

/** The key of the settings query: one set of settings for the whole shop, so no params. */
export const siteSettingsKey = ['site-settings'] as const;

export function useSiteSettingsQuery() {
  return useQuery({
    queryKey: siteSettingsKey,
    queryFn: ({ signal }) => siteSettingsService.get(signal),
  });
}

/**
 * The Business Info save. A save that went through puts the saved settings in the cache and clears the public data held in this browser,
 * so the public pages read the new facts next (the server clears its own cache itself). A refused save changes neither.
 */
export function useUpdateSiteSettings(
  options: Pick<SubmissionOptions<UpdateSiteSettingsRequest, SiteSettings>, 'onSuccess' | 'onFailure'> = {},
) {
  const queryClient = useQueryClient();
  return useSubmission<UpdateSiteSettingsRequest, SiteSettings>((_key, body) => siteSettingsService.update(body), {
    onSuccess: (saved, data) => {
      queryClient.setQueryData(siteSettingsKey, saved);
      invalidatePublicContent();
      options.onSuccess?.(saved, data);
    },
    ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
  });
}
