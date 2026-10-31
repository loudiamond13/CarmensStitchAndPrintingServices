// The order list entry form schema (OR-3; 07 D-19, D-40): it mirrors the server's list entry validator, so the browser checks every
// rule the server checks before a request is sent, with the server's own words. Uniqueness among all entries of the list (retired
// ones included) and the Others rename refusal are the server's alone and come back under Name.
import { z } from 'zod';
import { isCategoryTone, type CategoryTone } from '@/components/status';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

/** The longest entry name, counted after the trim. */
export const ORDER_LIST_NAME_MAX = 40;

const COPY = SETTINGS_COPY.errors;

/** `nameRequired` is the list's own line, such as "Enter a product type name.". */
export function orderListEntrySchema(nameRequired: string) {
  return z.object({
    name: z.string().trim().min(1, nameRequired).max(ORDER_LIST_NAME_MAX, COPY.nameTooLong),
    tone: z.string().refine((tone): tone is CategoryTone => isCategoryTone(tone), COPY.toneRequired),
  });
}
