// The My Money balance card (D-39, D-21, MONEY-02; UI-SPEC M1 "MoneyOnHandCard"): the overline "Money on hand", the caller's own
// figure from the server at the large size, and a line that says what the figure is made of. The card works out nothing. A balance
// below zero is danger-toned with the true minus sign, ₱0.00 is dimmed. It owns its loading and failure states; plan 10-19 puts the
// same card on one person's page for a Manager.
import { Money, overlineClasses } from '@/components/money';
import { Skeleton } from '@/components/feedback';
import { ErrorState, LoadingRegion } from '@/components/states';
import {
  moneyCardBodyClasses,
  moneyCardClasses,
  moneyCardExplanationClasses,
  moneyCardStateClasses,
  moneyCardZeroClasses,
} from '@/modules/admin/components/money.recipe';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { isNegativeMoney, round2 } from '@/utils/csps';

const COPY = MONEY_COPY.card;

export interface MoneyOnHandCardProps {
  query: MyMoneyCardQuery;
}

export function MoneyOnHandCard({ query }: MoneyOnHandCardProps) {
  const money = query.data;

  let body;
  if (query.isError) {
    body = (
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
  } else {
    // One region stays mounted from loading to loaded, so its status node can say the figure arrived.
    body = (
      <>
        <LoadingRegion loading={money === undefined} things={COPY.loadingThings}>
          {money === undefined ? (
            <Skeleton width={220} height={40} />
          ) : (
            <Money
              amount={money.balance}
              size="lg"
              tone={isNegativeMoney(money.balance) ? 'danger' : undefined}
              className={round2(money.balance) === 0 ? moneyCardZeroClasses : undefined}
            />
          )}
        </LoadingRegion>
        <p className={moneyCardExplanationClasses}>{COPY.explanation}</p>
      </>
    );
  }

  return (
    <section className={moneyCardClasses}>
      <div className={moneyCardBodyClasses}>
        <span className={overlineClasses}>{COPY.overline}</span>
        {body}
      </div>
    </section>
  );
}
