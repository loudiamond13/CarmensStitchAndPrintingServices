/* CSPS — domain types, formatting and the order math (core data rule).
   Every figure shown wherever an order appears comes from orderTotals(). */

/* D-09 (Core Value: server-computed totals): the browser's orderTotals(), discountAmount() and round2() figures are
   PREVIEWS. The server (Csps.Domain.Orders.OrderMath) is authoritative: once a save returns an order's totals, screens
   show the server's figures and never present a preview as the saved figure. The shared golden vectors
   (tests/fixtures/order-math-golden-vectors.json) prove both sides agree to the centavo. */

import { formatBusinessDate, formatCalendarDate } from './format';

/* ───────────── domain types ───────────── */

export type OrderStatus = 'pending' | 'mockup' | 'production' | 'ready' | 'completed' | 'cancelled';
export type ProductType =
  'Basketball Jersey' | 'Volleyball Jersey' | 'Moto Riding Jersey' | 'Long Sleeves' | 'Polo Shirt' | 'Custom Design';
export type PaymentMethod = 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';
export type ExpenseCategory = 'Rent' | 'Utilities' | 'Salaries' | 'Supplies' | 'Equipment' | 'Maintenance' | 'Others';
export type OrderExpenseCategory = 'Fabric' | 'Ink & paper' | 'Outsourcing' | 'Labor' | 'Delivery' | 'Others';
export type DiscountType = 'fixed' | 'percentage';
export type Role = 'admin' | 'manager';

export interface OrderItem {
  id?: string;
  productType?: ProductType;
  description?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}
export interface Payment {
  id?: string;
  date?: string; // ISO yyyy-mm-dd
  amount: number;
  method?: PaymentMethod;
  reference?: string;
  notes?: string;
}
export interface Discount {
  id?: string;
  reason?: string;
  type: DiscountType;
  value: number;
}
export interface OrderExpense {
  id?: string;
  date?: string;
  // SPEC-DEVIATION: lint no-redundant-type-constituents. `OrderExpenseCategory | string` is just `string`; the
  // ORDER_EXPENSE_CATEGORIES values are the suggested ones and any other text is still allowed. Same type.
  category?: string;
  description?: string;
  amount: number;
}
export interface OrderImage {
  id: string;
  name?: string;
  /** Image URL. When absent, the UI shows a MediaPlaceholder. */
  src?: string;
  /** Jersey number shown big on the placeholder. */
  number?: string;
}
export interface Order {
  id?: string;
  number: string; // "ORD-2026-0148"
  customer: string;
  team?: string;
  contact?: string;
  email?: string;
  address?: string;
  orderDate: string;
  dueDate: string;
  status: OrderStatus;
  notes?: string;
  overdue?: boolean;
  images?: OrderImage[]; // index 0 = cover
  items?: OrderItem[];
  payments?: Payment[];
  discounts?: Discount[];
  expenses?: OrderExpense[];
}
export interface CompanyExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  recordedBy: string;
}
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
/* SPEC-DEVIATION: D-41 R2-06 (owner, 2026-10-13). App. D.1's `total` was the amount before discount. The PRD §5.1
   names are used now: `subtotal` is the amount before discount and `total` is the amount after it
   (Subtotal − Discount), as the server's OrderMathResult names them. */
export interface Totals {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  expenses: number;
  profit: number;
  fullyPaid: boolean;
}
export interface CascadeCounts {
  items?: number;
  payments?: number;
  discounts?: number;
  expenses?: number;
  images?: number;
}

/* ───────────── option lists ───────────── */

export const PRODUCT_TYPES: ProductType[] = [
  'Basketball Jersey',
  'Volleyball Jersey',
  'Moto Riding Jersey',
  'Long Sleeves',
  'Polo Shirt',
  'Custom Design',
];
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'GCash', 'Maya', 'Bank Transfer'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Equipment',
  'Maintenance',
  'Others',
];
export const ORDER_EXPENSE_CATEGORIES: OrderExpenseCategory[] = [
  'Fabric',
  'Ink & paper',
  'Outsourcing',
  'Labor',
  'Delivery',
  'Others',
];
export const ORDER_STATUSES: Record<OrderStatus, string> = {
  pending: 'Pending',
  mockup: 'Mockup',
  production: 'In Production',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'mockup', 'production', 'ready'];

/* ───────────── formatting ───────────── */

// SPEC-DEVIATION: D-09 (see formatPeso). D.1's 2-decimal formatter read a binary float; this one groups the whole
// pesos (a bigint) and formatPeso appends the two centavo digits, so no float is ever formatted. Same text.
const pesoWholeFmt = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

/** "₱12,450.00"; negatives "−₱732.50" (U+2212 minus). */
export function formatPeso(n: number | string | null | undefined): string {
  // SPEC-DEVIATION: D-09 integer-centavo, half-away-from-zero rounding to match the server. The amount is rounded to
  // whole centavos first and formatted from the exact integer, never from a binary float. NaN and ±Infinity read
  // as 0 (D.1 showed "₱∞"), and an amount that rounds to 0 centavos has no minus (D.1 showed "−₱0.00" for -0.001).
  const centavos = toCentavos(n);
  const magnitude = centavos < 0n ? -centavos : centavos;
  const cents = (magnitude % 100n).toString().padStart(2, '0');
  return `${centavos < 0n ? '−₱' : '₱'}${pesoWholeFmt.format(magnitude / 100n)}.${cents}`;
}

/**
 * "Oct 6, 2026". Accepts a calendar date "2026-10-06" (no zone shift), an API instant with a zone, or a Date (both
 * shown in the business zone). Empty, a zone-less date-time and unparseable text → "—".
 * SPEC-DEVIATION (LIB-WR-07): App. D.1 formatted with getMonth/getDate/getFullYear, so an instant showed the calendar
 * day of the machine's zone, not Asia/Manila. This is now a thin wrapper over @/utils/format, which never reads the
 * machine's zone. New screens call formatCalendarDate / formatBusinessDate directly.
 */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? '—' : formatBusinessDate(d.toISOString());
  return d.length === 10 ? formatCalendarDate(d) : formatBusinessDate(d);
}

/* ───────────── order math ───────────── */

/* SPEC-DEVIATION: D-09 integer-centavo, half-away-from-zero rounding to match the server
   (MidpointRounding.AwayFromZero). App. D.1 rounded with Math.round(n * 100) / 100 in binary floating point, which
   previews 7.5% of ₱17.00 as ₱1.27 while the server saves ₱1.28. round2, discountAmount and orderTotals keep D.1's
   names and signatures, and round2 and discountAmount keep D.1's return shapes (orderTotals' Totals shape follows the
   PRD §5.1 names by D-41 R2-06, see Totals), but work in exact integer centavos (BigInt): a number is read through its
   shortest decimal text (String(n)), never n * 100, and turned back into a number through its exact decimal text
   (L-12). NaN and ±Infinity count as 0, as D.1's `Number(n) || 0` did for NaN.
   Pinned operation order, quoted from the vector file's `operationOrder`:
     "round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)" */

/** An exact fraction num / den, with den > 0. */
interface Exact {
  readonly num: bigint;
  readonly den: bigint;
}

const ZERO: Exact = { num: 0n, den: 1n };

/** A form value as an exact fraction, read through the number's shortest round-trip decimal text. */
function exactOf(value: number | string | null | undefined): Exact {
  const n = Number(value) || 0;
  if (!Number.isFinite(n)) return ZERO;
  // String(n) of a finite number is "123", "1.5", "1e+21" or "1.5e-7" (the sign is handled separately).
  const [mantissa = '0', exponent = '0'] = String(Math.abs(n)).split('e');
  const [whole = '0', fraction = ''] = mantissa.split('.');
  const shift = Number(exponent) - fraction.length;
  const digits = BigInt(whole + fraction);
  const magnitude = shift > 0 ? digits * 10n ** BigInt(shift) : digits;
  return { num: n < 0 ? -magnitude : magnitude, den: shift < 0 ? 10n ** BigInt(-shift) : 1n };
}

const add = (a: Exact, b: Exact): Exact => ({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const multiply = (a: Exact, b: Exact): Exact => ({ num: a.num * b.num, den: a.den * b.den });

/** Rounds an exact peso amount to whole centavos, half away from zero (the server's MidpointRounding.AwayFromZero). */
function roundToCentavos(value: Exact): bigint {
  const negative = value.num < 0n;
  const scaled = (negative ? -value.num : value.num) * 100n;
  const centavos = scaled / value.den + ((scaled % value.den) * 2n >= value.den ? 1n : 0n);
  return negative ? -centavos : centavos;
}

/** A form value in whole centavos, half away from zero. */
function toCentavos(value: number | string | null | undefined): bigint {
  return roundToCentavos(exactOf(value));
}

/** Whole centavos as exact decimal text: two decimals, no grouping, ASCII minus ("-732.50"). */
function centavosText(centavos: bigint): string {
  const digits = (centavos < 0n ? -centavos : centavos).toString().padStart(3, '0');
  return `${centavos < 0n ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** Whole centavos as the nearest number, through the exact decimal text, never centavos / 100 (L-12). */
function fromCentavos(centavos: bigint): number {
  return Number(centavosText(centavos));
}

const pesosOf = (centavos: bigint): Exact => ({ num: centavos, den: 100n });

function sumToCentavos(values: readonly (number | string | null | undefined)[]): bigint {
  return roundToCentavos(values.map(exactOf).reduce(add, ZERO));
}

/** Half away from zero at the centavo: round2(1.005) = 1.01, round2(10.075) = 10.08, round2(-1.005) = -1.01. */
export const round2 = (n: number | string | null | undefined): number => fromCentavos(toCentavos(n));

function discountCentavos(discount: Discount, subtotal: Exact): bigint {
  const value = exactOf(discount.value);
  return roundToCentavos(
    discount.type === 'percentage' ? multiply(multiply(subtotal, value), { num: 1n, den: 100n }) : value,
  );
}

/** fixed → value; percentage → value % of the subtotal (the items total, before discount). */
export function discountAmount(discount: Discount | null | undefined, subtotal: number): number {
  if (!discount) return 0;
  return fromCentavos(discountCentavos(discount, exactOf(subtotal)));
}

/**
 * PRD §5.1 names (D-41 R2-06):
 * Subtotal = Σ qty × unit price · Discount = Σ discounts · Total = Subtotal − Discount · Paid = Σ payments
 * Balance = Total − Paid · Expenses = Σ order expenses · Profit = Total − Expenses
 * Fully paid = Subtotal > 0 and Balance ≤ 0 (D-41 R2-06, NET-IN-01 ruled keep: a fully discounted unpaid order is
 * fully paid; an empty order is not)
 */
export function orderTotals(order: Partial<Order> | null | undefined): Totals {
  const o = order ?? {};
  // SPEC-DEVIATION: D-09 integer-centavo, half-away-from-zero rounding to match the server (see round2 above).
  // 1. Round the items total (the PRD Subtotal).
  const subtotal = roundToCentavos(
    (o.items ?? []).map((i) => multiply(exactOf(i.quantity), exactOf(i.unitPrice))).reduce(add, ZERO),
  );
  // 2. Round each discount (a percentage applies to the rounded subtotal). 3. Sum the discounts and round the sum:
  // each discount is already whole centavos, so the rounding of the sum is exact.
  const discount = (o.discounts ?? []).reduce((sum, d) => sum + discountCentavos(d, pesosOf(subtotal)), 0n);
  const paid = sumToCentavos((o.payments ?? []).map((p) => p.amount));
  const expenses = sumToCentavos((o.expenses ?? []).map((e) => e.amount));
  // 4. Subtract (PRD §5.1).
  const total = subtotal - discount;
  const balance = total - paid;
  return {
    subtotal: fromCentavos(subtotal),
    discount: fromCentavos(discount),
    total: fromCentavos(total),
    paid: fromCentavos(paid),
    balance: fromCentavos(balance),
    expenses: fromCentavos(expenses),
    profit: fromCentavos(total - expenses),
    fullyPaid: subtotal > 0n && balance <= 0n,
  };
}

// SPEC-DEVIATION: lint array-type (readonly T[] instead of ReadonlyArray<T>). Same type.
export const CASCADE_LABELS: readonly (readonly [keyof CascadeCounts, string])[] = [
  ['items', 'item'],
  ['payments', 'payment'],
  ['discounts', 'discount'],
  ['expenses', 'expense'],
  ['images', 'image'],
];

/** "This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images." ('' when all zero) */
export function cascadeSentence(counts: CascadeCounts = {}): string {
  const parts = CASCADE_LABELS.map(([k, one]) => [counts[k] ?? 0, one] as const)
    .filter(([n]) => n > 0)
    // SPEC-DEVIATION: lint restrict-plus-operands (String(n) in a template; the last part is popped instead of
    // indexed, so it is never undefined). Same sentence.
    .map(([n, one]) => `${String(n)} ${n === 1 ? one : one + 's'}`);
  const last = parts.pop();
  if (last === undefined) return '';
  const list = parts.length > 0 ? parts.join(', ') + ', and ' + last : last;
  return 'This will also delete ' + list + '.';
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export function passwordStrength(pw = ''): { score: StrengthScore; label: '' | 'Weak' | 'Fair' | 'Good' | 'Strong' } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = (!pw ? 0 : Math.max(1, Math.min(4, s - (pw.length < 8 ? 1 : 0)))) as StrengthScore;
  return { score, label: (['', 'Weak', 'Fair', 'Good', 'Strong'] as const)[score] };
}

/** "ORD-2026-0148" from year + sequence. */
// SPEC-DEVIATION: lint restrict-template-expressions (String(year)). Same output.
export const orderNumber = (year: number, seq: number): string => `ORD-${String(year)}-${String(seq).padStart(4, '0')}`;
