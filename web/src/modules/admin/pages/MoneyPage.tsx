// M1 My Money, /admin/money (D-39, MONEY-02; UI-SPEC M1). The header (the title, what the page shows and the primary Transfer button,
// aria-disabled with its visible reason when nothing is on hand, D-14) and the caller's own balance card, the same for both roles. The
// card reads the server's figure; nothing is worked out here. The Manager tabs and the ledger arrive in later plans (10-17, 10-19).
import { useEffect, useId } from 'react';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { moneyHeadActionsClasses, moneyHeadReasonClasses } from '@/modules/admin/components/money.recipe';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import { TransferButton, TransferReason, transferGate } from '@/modules/admin/components/TransferButton';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.page;

export function MoneyRoute() {
  const money = useMyMoneyQuery();
  const reasonId = useId();
  const gate = transferGate(money);

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
        <div className={moneyHeadActionsClasses}>
          <TransferButton query={money} reasonId={reasonId} variant="primary" size="md" />
          {gate.nothingOnHand && <TransferReason id={reasonId} className={moneyHeadReasonClasses} />}
        </div>
      </div>
      <MoneyOnHandCard query={money} />
    </>
  );
}
