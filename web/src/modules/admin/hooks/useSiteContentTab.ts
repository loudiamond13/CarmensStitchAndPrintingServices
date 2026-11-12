// The Site Content tab in the URL `tab` parameter (D-27, WEB-10). Business Info is the default and stays out of the URL; a change
// replaces the history entry; an invalid value reads as Business Info and is removed with one replace. The URL holds the tab name only.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

export const SITE_CONTENT_TABS = ['business', 'hours', 'products', 'testimonials', 'gallery'] as const;
export type SiteContentTab = (typeof SITE_CONTENT_TABS)[number];

const useSiteContentParams = createListParams({ tab: literalParser(SITE_CONTENT_TABS, 'business') });

export function useSiteContentTab() {
  const [{ tab }, { setFilter }] = useSiteContentParams();
  return {
    tab,
    setTab: (next: SiteContentTab): void => {
      setFilter('tab', next);
    },
  };
}
