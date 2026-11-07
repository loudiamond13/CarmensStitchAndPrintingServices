// RED stub (plan 10-13): replaced in the GREEN commit.
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';

export interface MoneyOnHandCardProps {
  query: MyMoneyCardQuery;
}

export function MoneyOnHandCard({ query }: MoneyOnHandCardProps) {
  return <section data-red-stub={query.isError ? 'error' : 'ok'} />;
}
