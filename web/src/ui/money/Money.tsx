// RED stub (plan 02-23): the converted Money arrives in GREEN.
import type { MoneySize, MoneyTone } from './money.recipe';

export interface MoneyProps {
  amount: number;
  size?: MoneySize | undefined;
  tone?: MoneyTone | undefined;
  className?: string | undefined;
}

export function Money(_props: MoneyProps) {
  return <span />;
}
