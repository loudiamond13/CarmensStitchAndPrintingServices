// One person's money page cleans its URL (WEB-10, D-31, D-42; plan 10-19) and returns nothing: the Ledger card reads the page, the rows per
// page and Show deleted itself. Calling useMoneyListParams here removes an invalid value, or a Manager-only one in an Admin's URL, with one
// replace even while the person loads. The page has no tabs, so a stray `tab` is dropped with one replace that leaves the other keys alone.
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef } from 'react';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';

const STRAY_KEYS = { tab: parseAsString };

export function useCleanStaffMoneyUrl(): void {
  useMoneyListParams();
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
}
