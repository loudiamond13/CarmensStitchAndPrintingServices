// The Orders schemas (OR-3). Skeleton for the red step: the real rules replace it.
import { z } from 'zod';

z.config({ jitless: true });

export const orderDateRangeSchema = z.object({ from: z.string(), to: z.string() });

export interface OrderRangeErrors {
  from: string | null;
  to: string | null;
}

export function orderRangeErrors(draft: { from: string; to: string }): OrderRangeErrors {
  void draft;
  return { from: null, to: null };
}
