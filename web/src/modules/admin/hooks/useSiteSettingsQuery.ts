// The staff view of the site settings (CONT-01), the Business Info save (PUB-03; plan 11-12) and the link preview picture (PUB-04; plan 11-34).
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { isHttpError } from '@/core/api/errors';
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

type PictureOptions<TData> = Pick<SubmissionOptions<TData, SiteSettings | null>, 'onSuccess' | 'onFailure'>;

/**
 * Reads the settings again after a picture change: the picture lives on the settings row, so the row's version moved (11-30 OI-1) and the
 * Business Info screen needs the new one. A read that fails leaves the settings marked for a new read and answers null: the picture itself
 * is saved, and that must not look like a failed upload.
 */
async function readSettingsAgain(queryClient: QueryClient): Promise<SiteSettings | null> {
  try {
    return await queryClient.query({
      queryKey: siteSettingsKey,
      queryFn: ({ signal }) => siteSettingsService.get(signal),
      staleTime: 0,
    });
  } catch {
    void queryClient.invalidateQueries({ queryKey: siteSettingsKey, exact: true });
    return null;
  }
}

/**
 * Puts a picture in as the link preview picture (plan 11-34): one Idempotency-Key per file, then the settings are read again and put in the
 * cache, and the public data held in this browser is cleared. The answer is the settings as read again, or null when that read failed. A
 * finished upload is a new intent the next time, so choosing the same file again sends it again. The Business Info form is not involved.
 */
export function useUploadSharePicture(options: PictureOptions<File> = {}) {
  const queryClient = useQueryClient();
  const generation = useRef(0);
  return useSubmission<File, SiteSettings | null>(
    async (key, file) => {
      await siteSettingsService.uploadSharePicture(file, file.name, key);
      return readSettingsAgain(queryClient);
    },
    {
      identity: (file) =>
        `${file.name}:${String(file.size)}:${String(file.lastModified)}:${String(generation.current)}`,
      onSuccess: (settings, file) => {
        generation.current += 1;
        invalidatePublicContent();
        options.onSuccess?.(settings, file);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}

/**
 * Takes the link preview picture off (plan 11-34). A picture that is already gone (404) is what the person asked for, so it counts as removed.
 * Then the settings are read again and the public data held in this browser is cleared.
 */
export function useRemoveSharePicture(options: PictureOptions<undefined> = {}) {
  const queryClient = useQueryClient();
  const generation = useRef(0);
  return useSubmission<undefined, SiteSettings | null>(
    async () => {
      try {
        await siteSettingsService.removeSharePicture();
      } catch (error) {
        if (!(isHttpError(error) && error.status === 404)) {
          throw error;
        }
      }
      return readSettingsAgain(queryClient);
    },
    {
      identity: () => `remove:${String(generation.current)}`,
      onSuccess: (settings, data) => {
        generation.current += 1;
        invalidatePublicContent();
        options.onSuccess?.(settings, data);
      },
      ...(options.onFailure === undefined ? {} : { onFailure: options.onFailure }),
    },
  );
}
