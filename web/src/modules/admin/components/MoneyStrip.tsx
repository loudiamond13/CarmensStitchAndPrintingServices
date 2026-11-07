// SPEC-GAP: D-46 App. E.6 has no money card, so the strip is composed from `.s-card`, the KpiCard tile look and the button recipes.
// The personal money strip under the dashboard greeting (D-46, D-21, MONEY-02; UI-SPEC D1 "MoneyStrip"): the wallet tile, the label
// "Your money on hand" over the caller's own figure from the server, and View Ledger. Plan 10-15 puts Transfer before it through
// `actions`. The strip works out nothing: the figure is the server's, in the danger tone below zero and dimmed at ₱0.00. It reads
// its own query, so a failed read leaves the rest of the dashboard alone, and View Ledger works whatever the state.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import { LoadingRegion } from '@/components/states';
import {
  moneyStripActionsClasses,
  moneyStripBodyClasses,
  moneyStripClasses,
  moneyStripFailedClasses,
  moneyStripFailedTextClasses,
  moneyStripFigureClasses,
  moneyStripLabelClasses,
  moneyStripTileClasses,
  moneyStripToneClasses,
} from '@/modules/admin/components/money.recipe';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { formatPeso, isNegativeMoney, round2 } from '@/utils/csps';

const COPY = MONEY_COPY.strip;
/** The page the strip links to (plan 10-17 fills it with the ledger). */
const LEDGER_PATH = '/admin/money';

export interface MoneyStripProps {
  query: MyMoneyCardQuery;
  /** Buttons before View Ledger (Transfer, plan 10-15). */
  actions?: ReactNode;
}

export function MoneyStrip({ query, actions }: MoneyStripProps) {
  const money = query.data;
  const tone =
    money === undefined
      ? 'plain'
      : isNegativeMoney(money.balance)
        ? 'danger'
        : round2(money.balance) === 0
          ? 'zero'
          : 'plain';

  let figure;
  if (query.isError) {
    figure = (
      <div className={moneyStripFailedClasses}>
        <p role="alert" className={moneyStripFailedTextClasses}>
          {COPY.failed}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void query.refetch();
          }}
        >
          {COPY.retry}
        </Button>
      </div>
    );
  } else if (money === undefined) {
    figure = <Skeleton width={160} height={28} />;
  } else {
    figure = (
      <span className={clsx(moneyStripFigureClasses, moneyStripToneClasses[tone])}>{formatPeso(money.balance)}</span>
    );
  }

  return (
    <section className={moneyStripClasses}>
      <span className={moneyStripTileClasses}>
        <Icon name="wallet" size={18} />
      </span>
      <LoadingRegion
        loading={money === undefined && !query.isError}
        failed={query.isError}
        things={COPY.things}
        className={moneyStripBodyClasses}
      >
        <span className={moneyStripLabelClasses}>{COPY.label}</span>
        {figure}
      </LoadingRegion>
      <div className={moneyStripActionsClasses}>
        {actions}
        <ButtonLink variant="ghost" size="sm" to={LEDGER_PATH}>
          {COPY.viewLedger}
        </ButtonLink>
      </div>
    </section>
  );
}
