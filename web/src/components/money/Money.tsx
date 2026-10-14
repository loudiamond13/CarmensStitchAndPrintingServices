// Money (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4), converted to utilities (D-33) with the App. D.3 props and
// markup: one span holding formatPeso's text ("₱12,450.00", negatives "−₱732.50" with U+2212, ORD-09) in tabular
// figures. The size and tone looks are complete literals in money.recipe.ts, keyed by the typed unions, so no class
// name is built at run time. The figure comes from the caller (the server's, or a csps.ts preview); Money only formats.
import clsx from 'clsx';
import { formatPeso } from '@/utils/csps';
import { moneyClasses, moneySizeClasses, moneyToneClasses, type MoneySize, type MoneyTone } from './money.recipe';

export interface MoneyProps {
  amount: number;
  size?: MoneySize | undefined;
  tone?: MoneyTone | undefined;
  /** Layout glue only (margin, placement); never a restyle (spec rule 3). */
  className?: string | undefined;
}

export function Money({ amount, size = 'md', tone, className }: MoneyProps) {
  return (
    <span
      className={clsx(moneyClasses, moneySizeClasses[size], tone !== undefined && moneyToneClasses[tone], className)}
    >
      {formatPeso(amount)}
    </span>
  );
}
