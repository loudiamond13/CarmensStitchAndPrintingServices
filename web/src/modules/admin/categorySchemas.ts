// The category form schema (OR-3; D-08, D-13, OQ-10; plan 06-17): it mirrors the server's category validator, so the browser checks
// every rule the server checks before a request is sent, with the server's own words. Uniqueness among all categories (retired ones
// included) and the Others rename refusal are the server's alone and come back under Name.
import { z } from 'zod';
import { isCategoryTone, type CategoryTone } from '@/components/status';
import { SETTINGS_COPY } from './settingsCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = SETTINGS_COPY.errors;

/** The longest category name, counted after the trim (OQ-10). */
export const CATEGORY_NAME_MAX = 40;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, COPY.nameRequired).max(CATEGORY_NAME_MAX, COPY.nameTooLong),
  tone: z.string().refine((tone): tone is CategoryTone => isCategoryTone(tone), COPY.toneRequired),
});

/** What the form holds while it is edited: every control is text. */
export type CategoryFormInput = z.input<typeof categoryFormSchema>;

export type CategoryFormValues = z.output<typeof categoryFormSchema>;
