// The My Money balance card (D-39, D-21, MONEY-02; UI-SPEC M1 "MoneyOnHandCard"): the overline "Money on hand", the caller's own
// figure from the server at the large size, and a line that says what the figure is made of. The card works out nothing. A balance
// below zero is danger-toned with the true minus sign, ₱0.00 is dimmed. It owns its loading and failure states; plan 10-19 puts the
// same card on one person's page for a Manager.
import clsx from 'clsx';
import { Money, overlineClasses } from '@/components/money';
import { Skeleton } from '@/components/feedback';
import { ErrorState, LoadingRegion } from '@/components/states';
import {
  moneyCardBodyClasses,
  moneyCardClasses,
  moneyCardExplanationClasses,
  moneyCardLongFigureClasses,
  moneyCardStateClasses,
  moneyCardZeroClasses,
} from '@/modules/admin/components/money.recipe';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { formatPeso, isNegativeMoney, round2 } from '@/utils/csps';

const COPY = MONEY_COPY.card;
/** A figure this long (₱100,000,000.00 and up) takes the card-width clamp so it stays inside the card (plan 06-18). */
const LONG_FIGURE = 15;

export interface MoneyOnHandCardProps {
  query: MyMoneyCardQuery;
}

export function MoneyOnHandCard({ query }: MoneyOnHandCardProps) {
  const money = query.data;

  // A read that failed shows its alert until Try Again runs; while the retry runs the skeleton stands in, even over an older figure.
  const failed = query.isError && !query.isFetching;
  const loading = query.isFetching && (money === undefined || query.isError);

  let content;
  if (failed) {
    content = (
      <div className={moneyCardStateClasses}>
        <ErrorState
          things={COPY.failedThings}
          align="start"
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  } else if (money === undefined || query.isError) {
    content = <Skeleton width={220} height={40} />;
  } else {
    content = (
      <Money
        amount={money.balance}
        size="lg"
        tone={isNegativeMoney(money.balance) ? 'danger' : undefined}
        className={clsx(
          round2(money.balance) === 0 && moneyCardZeroClasses,
          formatPeso(money.balance).length >= LONG_FIGURE && moneyCardLongFigureClasses,
        )}
      />
    );
  }
  // One region stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
  const body = (
    <>
      <LoadingRegion loading={loading} failed={failed} things={COPY.loadingThings}>
        {content}
      </LoadingRegion>
      {failed ? null : <p className={moneyCardExplanationClasses}>{COPY.explanation}</p>}
    </>
  );

  return (
    <section className={moneyCardClasses}>
      <div className={moneyCardBodyClasses}>
        <span className={overlineClasses}>{COPY.overline}</span>
        {body}
      </div>
    </section>
  );
}
