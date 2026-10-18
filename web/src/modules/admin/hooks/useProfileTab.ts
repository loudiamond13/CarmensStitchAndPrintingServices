// The My Profile tab in the URL `tab` parameter (D-23, WEB-10, T-05-33). Details is the default and stays out of the URL; a
// change replaces the history entry; an invalid value reads as Details and is removed with one replace. The URL holds the
// tab name only, never personal data.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

export const PROFILE_TABS = ['details', 'security', 'appearance'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

const useProfileParams = createListParams({ tab: literalParser(PROFILE_TABS, 'details') });

export function useProfileTab() {
  const [{ tab }, { setFilter }] = useProfileParams();
  return {
    tab,
    setTab: (next: ProfileTab): void => {
      setFilter('tab', next);
    },
  };
}
