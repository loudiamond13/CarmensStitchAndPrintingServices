// The money screens' URL state (WEB-10, D-31, D-42; plan 10-17): the tab, the page, the rows per page and, for a Manager, Show deleted,
// through the one shared list-state factory. Defaults stay out of the URL; an invalid value falls back and is removed with one replace;
// a size or filter change replaces the entry and resets the page; a page change pushes. `tab` is read by the Manager tabs (plan 10-19);
// it is defined here so one hook owns the whole URL of My Money.
//   - Manager-only values (a tab other than Mine, Show deleted) in an Admin's URL are never read: the Admin sees Mine with no Show
//     deleted at once, and one replace removes them from the URL. The server still answers 403 to an Admin who asks (T-10-35).
import { parseAsStringLiteral } from 'nuqs';
import { useEffect, useRef } from 'react';
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser, pageParser, pageSizeParser } from '@/lib/url-state/parsers';
import { useSession } from '@/modules/admin/hooks/useSession';

export const MONEY_TABS = ['mine', 'staff', 'transfers'] as const;

const useMoneyUrlParams = createListParams({
  tab: literalParser(MONEY_TABS, 'mine'),
  page: pageParser,
  size: pageSizeParser,
  deleted: parseAsStringLiteral(['true'] as const),
});

export function useMoneyListParams() {
  const [values, set] = useMoneyUrlParams();
  const { user } = useSession();
  const dropManagerOnly = user?.role === 'admin' && (values.tab !== 'mine' || values.deleted !== null);
  // One replace per visit to such a URL, even if the page renders again before the address has changed.
  const dropped = useRef(false);

  useEffect(() => {
    if (!dropManagerOnly) {
      dropped.current = false;
      return;
    }
    if (!dropped.current) {
      dropped.current = true;
      set.setFilters({ tab: null, deleted: null });
    }
  });

  return [dropManagerOnly ? { ...values, tab: 'mine' as const, deleted: null } : values, set] as const;
}
