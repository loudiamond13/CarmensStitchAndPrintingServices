// The order list entry form schema (OR-3). Skeleton: the real rules land in the green step.
import { z } from 'zod';

z.config({ jitless: true });

export const ORDER_LIST_NAME_MAX = 40;

export function orderListEntrySchema(nameRequired: string) {
  return z.object({ name: z.string(), tone: z.string() }).describe(nameRequired);
}
