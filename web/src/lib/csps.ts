/* CSPS — domain types, formatting and the order math (core data rule).
   Every figure shown wherever an order appears comes from orderTotals(). */

/* ───────────── domain types ───────────── */

export type OrderStatus = 'pending' | 'mockup' | 'production' | 'ready' | 'completed' | 'cancelled';
export type ProductType = 'Basketball Jersey' | 'Volleyball Jersey' | 'Moto Riding Jersey' | 'Long Sleeves' | 'Polo Shirt' | 'Custom Design';
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
  category?: OrderExpenseCategory | string;
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
export interface Totals {
  total: number;
  discount: number;
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

export const PRODUCT_TYPES: ProductType[] = ['Basketball Jersey', 'Volleyball Jersey', 'Moto Riding Jersey', 'Long Sleeves', 'Polo Shirt', 'Custom Design'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'GCash', 'Maya', 'Bank Transfer'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Equipment', 'Maintenance', 'Others'];
export const ORDER_EXPENSE_CATEGORIES: OrderExpenseCategory[] = ['Fabric', 'Ink & paper', 'Outsourcing', 'Labor', 'Delivery', 'Others'];
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

const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₱12,450.00"; negatives "−₱732.50" (U+2212 minus). */
export function formatPeso(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return (v < 0 ? '−₱' : '₱') + pesoFmt.format(Math.abs(v));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 6, 2026". Accepts ISO "2026-10-06" (treated as a local date) or a Date. Empty → "—". */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return MONTHS[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear();
}

/* ───────────── order math ───────────── */

export const round2 = (n: number | string | null | undefined): number => Math.round((Number(n) || 0) * 100) / 100;

/** fixed → value; percentage → value % of the items total. */
export function discountAmount(discount: Discount | null | undefined, itemsTotal: number): number {
  if (!discount) return 0;
  return round2(discount.type === 'percentage' ? (itemsTotal * (Number(discount.value) || 0)) / 100 : discount.value);
}

/**
 * Total = Σ qty × unit price · Discount = Σ discounts · Paid = Σ payments
 * Balance = Total − Discount − Paid · Expenses = Σ order expenses
 * Profit = Total − Discount − Expenses · Fully paid = Total > 0 and Balance ≤ 0
 */
export function orderTotals(order: Partial<Order> | null | undefined): Totals {
  const o = order ?? {};
  const total = round2((o.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0));
  const discount = round2((o.discounts ?? []).reduce((s, d) => s + discountAmount(d, total), 0));
  const paid = round2((o.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const expenses = round2((o.expenses ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const balance = round2(total - discount - paid);
  return { total, discount, paid, balance, expenses, profit: round2(total - discount - expenses), fullyPaid: total > 0 && balance <= 0 };
}

export const CASCADE_LABELS: ReadonlyArray<readonly [keyof CascadeCounts, string]> = [
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
    .map(([n, one]) => n + ' ' + (n === 1 ? one : one + 's'));
  if (!parts.length) return '';
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1] : parts[0];
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
export const orderNumber = (year: number, seq: number): string => `ORD-${year}-${String(seq).padStart(4, '0')}`;
