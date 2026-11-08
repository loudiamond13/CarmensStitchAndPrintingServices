// M1 My Money, /admin/money (D-39, MONEY-02, MONEY-03; UI-SPEC M1). The header (the title, what the page shows and the primary Transfer button,
// aria-disabled with its visible reason when nothing is on hand, D-14) shows on every tab. Below it:
//   - an Admin sees only their own money: the balance card and the Ledger card, with no tab strip (D-42). The browser never asks an Admin
//     for staff figures; the API refuses them too (OD-19).
//   - a Manager also gets the tabs Mine and All Staff (D-42), kept in the URL `tab` parameter through useMoneyListParams. Only the chosen
//     tab's content is mounted, so All Staff is read when its tab opens. The Transfers tab arrives with plan 10-20.
// Every figure is the server's; nothing is worked out here.
import { useEffect, useId } from 'react';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { LedgerCard } from '@/modules/admin/components/LedgerCard';
import {
  moneyHeadActionsClasses,
  moneyHeadReasonClasses,
  moneyPanelClasses,
} from '@/modules/admin/components/money.recipe';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import { StaffBalancesTable } from '@/modules/admin/components/StaffBalancesTable';
import { TransferButton, TransferReason, transferGate } from '@/modules/admin/components/TransferButton';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';
import { useMyMoneyQuery, type MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useStaffBalancesQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.page;
const ID_BASE = 'money';

/** The tabs this plan draws; the URL may name `transfers` (plan 10-20), which reads as Mine until that tab exists. */
type MoneyTab = 'mine' | 'staff';
const TAB_IDS: readonly MoneyTab[] = ['mine', 'staff'];
const TAB_ITEMS: readonly TabItem<MoneyTab>[] = TAB_IDS.map((id) => ({ id, label: COPY.tabs[id] }));

function MineContent({ money }: { money: MyMoneyCardQuery }) {
  return (
    <>
      <MoneyOnHandCard query={money} />
      <LedgerCard userId="me" />
    </>
  );
}

/** The All Staff tab. The hand-over window is wired in a later step of this plan. */
function AllStaffContent() {
  const staff = useStaffBalancesQuery(true);
  return (
    <StaffBalancesTable
      query={staff}
      onHandOver={() => {
        // Wired with the hand-over window.
      }}
    />
  );
}

export function MoneyRoute() {
  const money = useMyMoneyQuery();
  const reasonId = useId();
  const gate = transferGate(money);
  const { user } = useSession();
  const isManager = user?.role === 'manager';
  const [values, set] = useMoneyListParams();
  const tab: MoneyTab = isManager && values.tab === 'staff' ? 'staff' : 'mine';

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
      {isManager ? (
        <>
          <Tabs
            idBase={ID_BASE}
            items={TAB_ITEMS}
            value={tab}
            onChange={(next) => {
              set.setFilter('tab', next === 'mine' ? null : next);
            }}
          />
          {TAB_IDS.map((id) => (
            <div key={id} {...getTabPanelProps(ID_BASE, id)} hidden={tab !== id} className={moneyPanelClasses}>
              {tab === id && (id === 'staff' ? <AllStaffContent /> : <MineContent money={money} />)}
            </div>
          ))}
        </>
      ) : (
        <MineContent money={money} />
      )}
    </>
  );
}
