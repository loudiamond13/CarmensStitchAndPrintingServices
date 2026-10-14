// StatusBadge (App. D.3 "Status", CSPS-UI-SPEC.md §6.2): a Badge with a dot, in the order status's tone, showing the
// status label. The App. D.3 `csp-status` hook class has no rule and is dropped (D-33).
// SPEC-DEVIATION: D-33 an unknown status (a string from the API the types do not know) is detected with the typed guard
// isOrderStatus instead of App. D.3's `STATUS_TONE[status] ?? 'neutral'` and `ORDER_STATUSES[status] ?? status`, which
// strict TypeScript reports as unnecessary; the output is the same: the raw text in the neutral tone (T-02-49).
import { ORDER_STATUSES, type OrderStatus } from '@/utils/csps';
import { Badge } from './Badge';
import { isOrderStatus, STATUS_TONE } from './tones';

export interface StatusBadgeProps {
  status?: OrderStatus | undefined;
  /** Layout glue only (margin, placement); never a restyle (spec rule 3). */
  className?: string | undefined;
}

export function StatusBadge({ status = 'pending', className }: StatusBadgeProps) {
  const known = isOrderStatus(status);
  return (
    <Badge tone={known ? STATUS_TONE[status] : 'neutral'} dot className={className}>
      {known ? ORDER_STATUSES[status] : status}
    </Badge>
  );
}
