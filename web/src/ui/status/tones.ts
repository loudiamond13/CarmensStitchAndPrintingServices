// The badge tones and the three tone tables of CSPS-UI-SPEC.md §6.2 (App. D.3 "Status": BadgeTone, STATUS_TONE,
// PAYMENT_TONE, EXPENSE_TONE), with the App. D.3 values unchanged. The class look of each tone is in status.recipe.ts.
// SPEC-DEVIATION: D-33 PAYMENT_TONE and EXPENSE_TONE are keyed by the typed unions PaymentMethod and ExpenseCategory
// (App. D.3: Record<string, BadgeTone>), so a missing or misspelt key is a compile error instead of a badge that
// silently loses its look (T-02-49). Order expense categories use the neutral tone (§6.2) and need no table.
import { ORDER_STATUSES, type ExpenseCategory, type OrderStatus, type PaymentMethod } from '@/lib/csps';

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

/** Company expense category → badge tone (§6.2 company expense category badges). */
export const EXPENSE_TONE: Readonly<Record<ExpenseCategory, BadgeTone>> = {
  Rent: 'accent',
  Utilities: 'info',
  Salaries: 'mockup',
  Supplies: 'warning',
  Equipment: 'success',
  Maintenance: 'neutral',
  Others: 'neutral',
};

/**
 * True for the six order statuses. A status string from the API that the types do not know is not one, so StatusBadge
 * shows it as it is, in the neutral tone (App. D.3's `?? 'neutral'` and `?? status` fallbacks, T-02-49).
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.hasOwn(ORDER_STATUSES, value);
}
