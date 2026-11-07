// RED stub (plan 10-13): replaced in the GREEN commit.
import type { ReactNode } from 'react';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';

export interface MoneyStripProps {
  query: MyMoneyCardQuery;
  actions?: ReactNode;
}

export function MoneyStrip({ query, actions }: MoneyStripProps) {
  return <section data-red-stub={query.isError ? 'error' : 'ok'}>{actions}</section>;
}
