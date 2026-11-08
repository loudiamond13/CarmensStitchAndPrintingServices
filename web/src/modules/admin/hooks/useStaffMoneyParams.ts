// One person's money page keeps its view in the URL (WEB-10, D-31, D-42; plan 10-19): the page, the rows per page and, for a Manager,
// Show deleted, by the same rules as My Money (useMoneyListParams, which the Ledger card reads too). The page has no tabs, so a stray
// `tab` is dropped with one replace that leaves the other keys alone.
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef } from 'react';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';

const STRAY_KEYS = { tab: parseAsString };

export function useStaffMoneyParams() {
  const [{ page, size, deleted }, set] = useMoneyListParams();
  const [{ tab }, setStray] = useQueryStates(STRAY_KEYS);
  // One replace per visit to such a URL, even if the page renders again before the address has changed.
  const dropped = useRef(false);

  useEffect(() => {
    if (tab === null) {
      dropped.current = false;
      return;
    }
    if (!dropped.current) {
      dropped.current = true;
      void setStray({ tab: null }, { history: 'replace' });
    }
  });

  return [{ page, size, deleted }, set] as const;
}
