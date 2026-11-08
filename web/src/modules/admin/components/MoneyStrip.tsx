// SPEC-GAP: D-46 App. E.6 has no money card, so the strip is composed from `.s-card`, the KpiCard tile look and the button recipes.
// The personal money strip under the dashboard greeting (D-46, D-21, MONEY-02; UI-SPEC D1 "MoneyStrip"): the wallet tile, the label
// "Your money on hand" over the caller's own figure from the server, Transfer and View Ledger. The strip works out nothing: the figure is the server's, in the danger tone below zero and dimmed at ₱0.00. It reads
// its own query, so a failed read leaves the rest of the dashboard alone, and View Ledger works whatever the state.
// Phones (money.recipe.ts): the tile is hidden, the figure stays on one line (whitespace-nowrap) and the buttons wrap to their own row.
import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import { LoadingRegion } from '@/components/states';
import { TransferButton, TransferReason, transferGate } from '@/modules/admin/components/TransferButton';
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
/** The page the strip links to. */
const LEDGER_PATH = '/admin/money';

export interface MoneyStripProps {
  query: MyMoneyCardQuery;
  /** Replaces the connected Transfer button; only the Component Showcase passes it, so a demo strip never opens the real window. */
  transfer?: (reasonId: string) => ReactNode;
  /** Buttons after Transfer and before View Ledger. */
  actions?: ReactNode;
}

export function MoneyStrip({ query, actions, transfer }: MoneyStripProps) {
  const labelId = useId();
  const reasonId = useId();
  const gate = transferGate(query);
  const money = query.data;
  const tone =
    money === undefined
      ? 'plain'
      : isNegativeMoney(money.balance)
        ? 'danger'
        : round2(money.balance) === 0
          ? 'zero'
          : 'plain';

  // A read that failed shows its alert until Try Again runs; while the retry runs the skeleton stands in, even over an older figure.
  const failed = query.isError && !query.isFetching;
  const loading = query.isFetching && (money === undefined || query.isError);

  let figure;
  if (failed) {
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
  } else if (money === undefined || query.isError) {
    figure = <Skeleton width={160} height={28} />;
  } else {
    figure = (
      <span className={clsx(moneyStripFigureClasses, moneyStripToneClasses[tone])}>{formatPeso(money.balance)}</span>
    );
  }

  return (
    <section className={moneyStripClasses} aria-labelledby={labelId}>
      <span className={moneyStripTileClasses}>
        <Icon name="wallet" size={18} />
      </span>
      <LoadingRegion loading={loading} failed={failed} things={COPY.things} className={moneyStripBodyClasses}>
        <span id={labelId} className={moneyStripLabelClasses}>
          {COPY.label}
        </span>
        {figure}
      </LoadingRegion>
      <div className={moneyStripActionsClasses}>
        {transfer ? transfer(reasonId) : <TransferButton query={query} reasonId={reasonId} />}
        {actions}
        <ButtonLink variant="ghost" size="sm" to={LEDGER_PATH}>
          {COPY.viewLedger}
        </ButtonLink>
      </div>
      {gate.nothingOnHand && <TransferReason id={reasonId} />}
    </section>
  );
}
