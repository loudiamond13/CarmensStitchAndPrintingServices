// M1 My Money, /admin/money (D-39, MONEY-02; UI-SPEC M1). The header (the title and what the page shows) and the caller's own
// balance card, the same for both roles. The card reads the server's figure; nothing is worked out here. The Manager tabs, the
// Transfer button and the ledger arrive in later plans (10-15, 10-17, 10-19).
import { useEffect } from 'react';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.page;

export function MoneyRoute() {
  const money = useMyMoneyQuery();

  useEffect(() => {
    document.title = `${COPY.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{COPY.title}</h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <MoneyOnHandCard query={money} />
    </>
  );
}
