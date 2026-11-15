// The Site Content tab in the URL `tab` parameter (D-27, WEB-10). Business Info is the default and stays out of the URL; a change
// replaces the history entry; an invalid value reads as Business Info and is removed with one replace. The URL holds the tab name only,
// except on the Gallery tab, whose line, page and size (useGalleryTabParams) belong to it: any other tab removes them, in the same replace
// as the tab change, and a link that carries them on another tab has them removed with one replace.
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect } from 'react';
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

export const SITE_CONTENT_TABS = ['business', 'hours', 'products', 'testimonials', 'gallery'] as const;
export type SiteContentTab = (typeof SITE_CONTENT_TABS)[number];

const useSiteContentParams = createListParams({ tab: literalParser(SITE_CONTENT_TABS, 'business') });

/** The Gallery tab's own keys, read as raw text here so another tab can tell they are there and clear them. */
const GALLERY_KEYS = { line: parseAsString, page: parseAsString, size: parseAsString };
const NO_GALLERY_PARAMS = { line: null, page: null, size: null };

export function useSiteContentTab() {
  const [{ tab }, { setFilter }] = useSiteContentParams();
  const [gallery, setGallery] = useQueryStates(GALLERY_KEYS);
  const hasGalleryParams = gallery.line !== null || gallery.page !== null || gallery.size !== null;
  const strayGalleryParams = tab !== 'gallery' && hasGalleryParams;

  useEffect(() => {
    if (strayGalleryParams) {
      void setGallery(NO_GALLERY_PARAMS, { history: 'replace' });
    }
  }, [strayGalleryParams, setGallery]);

  return {
    tab,
    setTab: (next: SiteContentTab): void => {
      setFilter('tab', next);
      if (next !== 'gallery' && hasGalleryParams) {
        void setGallery(NO_GALLERY_PARAMS, { history: 'replace' });
      }
    },
  };
}
