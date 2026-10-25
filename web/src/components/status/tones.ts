// The badge tones and the two fixed tone tables of CSPS-UI-SPEC.md §6.2 (App. D.3 "Status": BadgeTone, STATUS_TONE,
// PAYMENT_TONE), with the App. D.3 values unchanged, and the category tone list of the company expense categories. The class
// look of each tone is in status.recipe.ts.
// SPEC-DEVIATION: D-33 PAYMENT_TONE is keyed by the typed union PaymentMethod (App. D.3: Record<string, BadgeTone>), so a
// missing or misspelt key is a compile error instead of a badge that silently loses its look (T-02-49). Order expense
// categories use the neutral tone (§6.2) and need no table.
// SPEC-DEVIATION: D-08 / D-13 App. D.3's fixed expense tone table (seven categories) is replaced by CATEGORY_TONES: a Manager edits
// the category list, and each category stores one of six tones (plan 06-04).
import { ORDER_STATUSES, type OrderStatus, type PaymentMethod } from '@/utils/csps';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'mockup' | 'danger' | 'solid';

/** Order status → badge tone (§6.2 StatusBadge table). */
export const STATUS_TONE: Readonly<Record<OrderStatus, BadgeTone>> = {
  pending: 'neutral',
  mockup: 'mockup',
  production: 'warning',
  ready: 'info',
  completed: 'success',
  cancelled: 'danger',
};

/** Payment method → badge tone (§6.2 payment method badges). */
export const PAYMENT_TONE: Readonly<Record<PaymentMethod, BadgeTone>> = {
  GCash: 'info',
  Maya: 'success',
  Cash: 'neutral',
  'Bank Transfer': 'mockup',
};

/**
 * The six tones a Manager may give a category (D-13). Danger is left out because red reads as an error or a cancelled order, and
 * solid because its orange fill is reserved for the accent role. Every one is an existing tone that passed AA in both themes.
 */
export const CATEGORY_TONES = [
  'neutral',
  'accent',
  'info',
  'mockup',
  'warning',
  'success',
] as const satisfies readonly BadgeTone[];

export type CategoryTone = (typeof CATEGORY_TONES)[number];

/** Each category tone in words, so color is never the only cue in the color picker (UI-SPEC "Badge color"). */
export const CATEGORY_TONE_LABEL: Readonly<Record<CategoryTone, string>> = {
  neutral: 'Taupe',
  accent: 'Orange',
  info: 'Blue',
  mockup: 'Plum',
  warning: 'Amber',
  success: 'Green',
};

/** True for the six category tones. A tone string from the API that the types do not know is not one, and shows as neutral. */
export function isCategoryTone(value: string): value is CategoryTone {
  return (CATEGORY_TONES as readonly string[]).includes(value);
}

/**
 * True for the six order statuses. A status string from the API that the types do not know is not one, so StatusBadge
 * shows it as it is, in the neutral tone (App. D.3's `?? 'neutral'` and `?? status` fallbacks, T-02-49).
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.hasOwn(ORDER_STATUSES, value);
}
