// Order fixtures for component and service tests (plan 08-06): the UI-SPEC section 12.2 orders as typed API answers, builders
// with overrides, and one set of MSW handlers that answer and record every order route. Later order plans only import them.
// Names are made up. Every figure is written out (the same numbers the server would store), never worked out in a test.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { PRODUCT_TYPES } from '@/test/orderListFixtures';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type OrderDetailFixture = Schemas['OrderDetailResponse'];
export type OrderListEntryFixture = Schemas['OrderListEntry'];
export type OrderListFixture = Schemas['OrderListResponse'];
export type OrderItemFixture = Schemas['OrderItemResponse'];
export type OrderDiscountFixture = Schemas['OrderDiscountResponse'];
export type OrderPaymentFixture = Schemas['OrderPaymentResponse'];
export type OrderExpenseFixture = Schemas['OrderExpenseResponse'];
export type OrderRefundFixture = Schemas['OrderRefundResponse'];
export type OrderTotalsFixture = Schemas['OrderTotalsResponse'];
export type DeletedOrderListFixture = Schemas['DeletedOrderListResponse'];
export type ListRefFixture = Schemas['OrderListRef'];
export type ActorRefFixture = Schemas['ActorRef'];

/** The business today the fixtures answer with: ORD-2026-0153, due Oct 5, is overdue by 3 days. */
export const ORDER_TODAY = '2026-10-08';
/** A row version the fixtures send back. */
export const ORDER_VERSION = 'AAAAAAAAB9E=';

export const ORDER_STAFF: ActorRefFixture = {
  id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  name: 'Carmen Reyes',
  formerStaff: false,
};
export const ORDER_STAFF_TWO: ActorRefFixture = {
  id: '00000000-0000-4000-8000-0000000000a3',
  name: 'Paolo Garcia',
  formerStaff: false,
};

export const BASKETBALL_JERSEY: ListRefFixture = {
  id: '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6',
  name: 'Basketball Jersey',
  tone: 'accent',
  retired: false,
};
export const POLO_SHIRT: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000b2',
  name: 'Polo Shirt',
  tone: 'info',
  retired: false,
};
export const LONG_SLEEVES: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000b3',
  name: 'Long Sleeves',
  tone: 'success',
  retired: false,
};
export const CUSTOM_DESIGN: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000b4',
  name: 'Custom Design',
  tone: 'mockup',
  retired: false,
};

export const GCASH: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'GCash',
  tone: 'info',
  retired: false,
};
export const CASH: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000c2',
  name: 'Cash',
  tone: 'success',
  retired: false,
};

export const FABRIC: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000d1',
  name: 'Fabric',
  tone: 'accent',
  retired: false,
};
export const INK_AND_PAPER: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000d2',
  name: 'Ink & paper',
  tone: 'info',
  retired: false,
};
export const OUTSOURCING: ListRefFixture = {
  id: '00000000-0000-4000-8000-0000000000d3',
  name: 'Outsourcing',
  tone: 'warning',
  retired: false,
};

/** A fixed order id from its number, so tests can name an order without a literal. */
export function orderId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

let childSeed = 0;

/** A fixed-shape id for a child row; the kind digit keeps items, payments, expenses, discounts and refunds apart. */
function childId(kind: number): string {
  childSeed += 1;
  return `00000000-0000-4000-9${String(kind)}00-${String(childSeed).padStart(12, '0')}`;
}

/** A line item with its own total, as the server stores it. */
export function orderItem(
  productType: ListRefFixture,
  description: string,
  quantity: number,
  unitPrice: number,
  overrides: Partial<OrderItemFixture> = {},
): OrderItemFixture {
  return {
    id: childId(1),
    productType,
    description,
    sizeVariant: null,
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-09-28T02:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    ...overrides,
  };
}

export function orderPayment(
  paymentDate: string,
  method: ListRefFixture,
  amount: number,
  overrides: Partial<OrderPaymentFixture> = {},
): OrderPaymentFixture {
  return {
    id: childId(2),
    paymentDate,
    method,
    amount,
    reference: null,
    notes: null,
    receivedBy: ORDER_STAFF,
    receivedByActive: true,
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-09-28T03:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    ...overrides,
  };
}

export function orderExpense(
  expenseDate: string,
  category: ListRefFixture,
  amount: number,
  description: string | null,
  overrides: Partial<OrderExpenseFixture> = {},
): OrderExpenseFixture {
  return {
    id: childId(3),
    expenseDate,
    category,
    description,
    amount,
    paidBy: ORDER_STAFF,
    paidByActive: true,
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-10-01T03:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    ...overrides,
  };
}

export function orderDiscount(
  kind: 'percentage' | 'fixed',
  value: number,
  reason: string,
  overrides: Partial<OrderDiscountFixture> = {},
): OrderDiscountFixture {
  return {
    id: childId(4),
    kind,
    value,
    reason,
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-09-28T02:30:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    ...overrides,
  };
}

export function orderRefund(
  refundDate: string,
  amount: number,
  reason: string,
  overrides: Partial<OrderRefundFixture> = {},
): OrderRefundFixture {
  return {
    id: childId(5),
    refundDate,
    amount,
    reason,
    refundedBy: ORDER_STAFF,
    refundedByActive: true,
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-10-04T03:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    ...overrides,
  };
}

/** The money block of an order, with every figure written out. */
function totals(overrides: Partial<OrderTotalsFixture>): OrderTotalsFixture {
  return {
    subtotal: 0,
    discount: 0,
    total: 0,
    paid: 0,
    refunded: 0,
    balance: 0,
    customerCredit: 0,
    fullyPaid: false,
    expenses: 0,
    profit: 0,
    ...overrides,
  };
}

/** One full order answer. The defaults are ORD-2026-0148; a test overrides what it needs. */
export function buildOrderDetail(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return {
    id: orderId(148),
    number: 'ORD-2026-0148',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 123 4567',
    email: 'juan.dc@example.ph',
    address: 'Brgy. San Roque, Marikina City',
    orderDate: '2026-09-28',
    dueDate: '2026-10-14',
    notes: 'V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo.',
    status: 'production',
    statusChangedAt: '2026-10-01T02:00:00Z',
    statusHistory: [
      { from: null, to: 'pending', changedAt: '2026-09-28T02:00:00Z', changedBy: ORDER_STAFF },
      { from: 'pending', to: 'production', changedAt: '2026-10-01T02:00:00Z', changedBy: ORDER_STAFF },
    ],
    items: [
      orderItem(BASKETBALL_JERSEY, 'Jersey top, sublimated, names and numbers', 15, 650, { sizeVariant: 'S-XL' }),
      orderItem(BASKETBALL_JERSEY, 'Shorts, matching colorway', 15, 300, { sizeVariant: 'S-XL' }),
      orderItem(POLO_SHIRT, 'Coach polo, embroidered logo', 2, 550, { sizeVariant: 'L' }),
      orderItem(LONG_SLEEVES, 'Warm-up shooting shirt', 15, 420, { sizeVariant: 'S-XL' }),
      orderItem(CUSTOM_DESIGN, 'Team logo redraw and vector cleanup', 1, 800),
    ],
    discounts: [orderDiscount('percentage', 5, 'Barangay league discount')],
    payments: [
      orderPayment('2026-09-28', GCASH, 10000, { reference: '9012 345 678901', notes: '50% downpayment' }),
      orderPayment('2026-10-03', CASH, 2000, { notes: 'For 2 added coach polos' }),
    ],
    expenses: [
      orderExpense('2026-10-01', FABRIC, 3825, 'Dri-fit mesh, 45 yds'),
      orderExpense('2026-10-02', INK_AND_PAPER, 1640, 'Sublimation ink + transfer paper'),
      orderExpense('2026-10-04', OUTSOURCING, 600, 'Embroidery, coach polos'),
    ],
    refunds: [],
    totals: totals({
      subtotal: 22450,
      discount: 1122.5,
      total: 21327.5,
      paid: 12000,
      balance: 9327.5,
      expenses: 6065,
      profit: 15262.5,
    }),
    recordedBy: ORDER_STAFF,
    recordedAt: '2026-09-28T02:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    today: ORDER_TODAY,
    version: ORDER_VERSION,
    ...overrides,
  };
}

/** ORD-2026-0148: In Production, balance due 9,327.50, due Oct 14. */
export const order0148: OrderDetailFixture = buildOrderDetail();

/** ORD-2026-0151: Ready and paid in full (ORD-12), a fixed 500 discount. */
export const order0151: OrderDetailFixture = buildOrderDetail({
  id: orderId(151),
  number: 'ORD-2026-0151',
  customerName: 'Mark Villanueva',
  teamName: 'Tondo Riders MC',
  orderDate: '2026-09-30',
  dueDate: '2026-10-10',
  status: 'ready',
  items: [orderItem(BASKETBALL_JERSEY, 'Riding club jersey', 20, 1150)],
  discounts: [orderDiscount('fixed', 500, 'Club discount')],
  payments: [orderPayment('2026-09-30', GCASH, 12000), orderPayment('2026-10-05', CASH, 10500)],
  expenses: [orderExpense('2026-10-01', FABRIC, 7200, null), orderExpense('2026-10-02', INK_AND_PAPER, 2100, null)],
  totals: totals({
    subtotal: 23000,
    discount: 500,
    total: 22500,
    paid: 22500,
    balance: 0,
    fullyPaid: true,
    expenses: 9300,
    profit: 13200,
  }),
});

/** ORD-2026-0153: Mockup, no team, due Oct 5 so overdue by 3 days on ORDER_TODAY. */
export const order0153: OrderDetailFixture = buildOrderDetail({
  id: orderId(153),
  number: 'ORD-2026-0153',
  customerName: 'Angelica Santos',
  teamName: null,
  orderDate: '2026-10-03',
  dueDate: '2026-10-05',
  status: 'mockup',
  items: [orderItem(BASKETBALL_JERSEY, 'Practice jersey', 12, 780)],
  discounts: [],
  payments: [orderPayment('2026-10-03', CASH, 3000)],
  expenses: [],
  totals: totals({ subtotal: 9360, total: 9360, paid: 3000, balance: 6360, profit: 9360 }),
});

/** A Ready order the customer overpaid by 1,000.00: the card shows "Credit ₱1,000.00". */
export const creditOrder: OrderDetailFixture = buildOrderDetail({
  id: orderId(160),
  number: 'ORD-2026-0160',
  customerName: 'Rhea Dizon',
  teamName: 'Lady Spikers QC',
  orderDate: '2026-10-01',
  dueDate: '2026-10-20',
  status: 'ready',
  items: [orderItem(BASKETBALL_JERSEY, 'Volleyball jersey', 10, 800)],
  discounts: [],
  payments: [orderPayment('2026-10-01', GCASH, 9000)],
  expenses: [],
  totals: totals({
    subtotal: 8000,
    total: 8000,
    paid: 9000,
    balance: 0,
    customerCredit: 1000,
    profit: 8000,
  }),
});

/** A Cancelled order with 3,000.00 paid and 1,000.00 handed back: the money still owed is "Not collected". */
export const cancelledOrderWithRefunds: OrderDetailFixture = buildOrderDetail({
  id: orderId(139),
  number: 'ORD-2026-0139',
  customerName: 'Jessa Ramos',
  teamName: 'Kabataan Liga ng Pasig',
  orderDate: '2026-09-08',
  dueDate: '2026-09-25',
  status: 'cancelled',
  items: [orderItem(BASKETBALL_JERSEY, 'League jersey', 10, 850)],
  discounts: [],
  payments: [orderPayment('2026-09-08', CASH, 3000)],
  expenses: [],
  refunds: [orderRefund('2026-09-20', 1000, 'Order cancelled by the customer')],
  totals: totals({
    subtotal: 8500,
    total: 8500,
    paid: 3000,
    refunded: 1000,
    balance: 5500,
    profit: 8500,
  }),
});

/** An imported order with no due date. */
export const noDueDateOrder: OrderDetailFixture = buildOrderDetail({
  id: orderId(101),
  number: 'ORD-2026-0101',
  customerName: 'Ramon Bautista',
  teamName: null,
  orderDate: '2026-08-12',
  dueDate: null,
  status: 'pending',
  items: [orderItem(POLO_SHIRT, 'Imported polo order', 8, 500)],
  discounts: [],
  payments: [],
  expenses: [],
  totals: totals({ subtotal: 4000, total: 4000, balance: 4000, profit: 4000 }),
});

/** ORD-2026-0142: Completed and paid in full. */
export const completedOrder: OrderDetailFixture = buildOrderDetail({
  id: orderId(142),
  number: 'ORD-2026-0142',
  customerName: 'Ramon Bautista',
  teamName: 'Marikina Moto Club',
  orderDate: '2026-09-12',
  dueDate: '2026-09-30',
  status: 'completed',
  items: [orderItem(BASKETBALL_JERSEY, 'Club jersey', 30, 690)],
  discounts: [orderDiscount('fixed', 1000, 'Loyal customer')],
  payments: [orderPayment('2026-09-12', GCASH, 10000), orderPayment('2026-09-28', CASH, 9700)],
  expenses: [orderExpense('2026-09-14', FABRIC, 8900, null)],
  totals: totals({
    subtotal: 20700,
    discount: 1000,
    total: 19700,
    paid: 19700,
    balance: 0,
    fullyPaid: true,
    expenses: 8900,
    profit: 10800,
  }),
});

/** ORD-2026-0150: Delivered with a balance still due. */
export const deliveredOrder: OrderDetailFixture = buildOrderDetail({
  id: orderId(150),
  number: 'ORD-2026-0150',
  customerName: 'Liza Cruz',
  teamName: 'St. Jude Parish Youth',
  orderDate: '2026-09-29',
  dueDate: '2026-10-06',
  status: 'delivered',
  items: [orderItem(POLO_SHIRT, 'Parish polo', 10, 500)],
  discounts: [],
  payments: [orderPayment('2026-09-29', CASH, 2000)],
  expenses: [],
  totals: totals({ subtotal: 5000, total: 5000, paid: 2000, balance: 3000, profit: 5000 }),
});

/** The list row of an order: the figures the list stores, the pieces as the sum of the item quantities. */
export function listEntryOf(order: OrderDetailFixture): OrderListEntryFixture {
  const t = order.totals;
  return {
    id: order.id,
    number: order.number,
    customerName: order.customerName,
    teamName: order.teamName,
    orderDate: order.orderDate,
    dueDate: order.dueDate,
    status: order.status,
    statusChangedAt: order.statusChangedAt,
    pieces: order.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    paid: t.paid,
    refunded: t.refunded,
    balance: t.balance,
    customerCredit: t.customerCredit,
    fullyPaid: t.fullyPaid,
  };
}

/** One list row; the defaults are ORD-2026-0148. */
export function buildOrderListEntry(overrides: Partial<OrderListEntryFixture> = {}): OrderListEntryFixture {
  return { ...listEntryOf(order0148), ...overrides };
}

/** The list answer for some rows. `counts` are the list-wide figures (D-41); they default to the rows shown. */
export function buildOrderList(
  entries: readonly OrderListEntryFixture[],
  counts: { all?: number; active?: number } & Partial<
    Pick<OrderListFixture, 'total' | 'page' | 'pageSize' | 'today'>
  > = {},
): OrderListFixture {
  return {
    items: [...entries],
    total: counts.total ?? entries.length,
    page: counts.page ?? 1,
    pageSize: counts.pageSize ?? 20,
    allOrders: counts.all ?? entries.length,
    activeOrders: counts.active ?? entries.length,
    today: counts.today ?? ORDER_TODAY,
  };
}

/** The four rows most list tests use: 0148, 0151, 0153 and the credit order, with 148 orders and 37 active in the shop. */
export function standardOrderList(): OrderListFixture {
  return buildOrderList([order0148, order0151, order0153, creditOrder].map(listEntryOf), { all: 148, active: 37 });
}

/** A problem+json answer with a status and, optionally, a machine code. */
export function orderProblem(status: number, code?: string): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, ...(code === undefined ? {} : { code }) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** One write the fake API received. */
export interface OrderWrite {
  method: 'POST' | 'PUT' | 'DELETE';
  /** The path after `/api/v1`, for example `/orders/{id}/status`. */
  path: string;
  /** The parsed JSON body, or null when there was none. */
  body: unknown;
  /** The Idempotency-Key header, or null when none was sent. */
  key: string | null;
}

export type OrderResult<T> = T | Response | Promise<T | Response>;

export interface OrderHandlerOptions {
  /** The list answer, or a function of the request URL. Default: the standard four rows. */
  list?: OrderListFixture | ((url: URL) => OrderResult<OrderListFixture>);
  /** The deleted list answer. Default: an empty page. */
  deleted?: DeletedOrderListFixture | ((url: URL) => OrderResult<DeletedOrderListFixture>);
  /** The order GET /orders/{id} answers, or a function of the id. Default: ORD-2026-0148. */
  detail?: OrderDetailFixture | ((id: string) => OrderResult<OrderDetailFixture>);
  /**
   * What a write answers. Return nothing to take the default: 201 (create) or 200 (every other change) with the order, or
   * 204 (delete, restore and permanent delete of an order).
   */
  reply?: (write: OrderWrite) => Response | Promise<Response> | undefined;
}

/** What the fake API recorded. */
export interface OrderBackend {
  /** Every GET /orders request URL, in order. */
  lists: URL[];
  /** Every GET /orders/deleted request URL, in order. */
  deletedLists: URL[];
  /** Every order id read through GET /orders/{id}, in order. */
  reads: string[];
  /** Every POST, PUT and DELETE under /orders, in order. */
  writes: OrderWrite[];
}

const CHILD_KINDS = ['items', 'discounts', 'payments', 'expenses', 'refunds'] as const;

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function resolve<T>(source: T | ((arg: never) => OrderResult<T>), arg: unknown): Promise<T | Response> {
  return typeof source === 'function' ? await (source as (value: unknown) => OrderResult<T>)(arg) : source;
}

/**
 * Answers and records every order route: the list, the deleted list, one order, create, edit details, status, delete,
 * restore, permanent delete, and add, edit and remove of items, discounts, payments, expenses and refunds. A later call
 * replaces an earlier one. Plain function, named like a hook only because it plugs the fake API into a test.
 */
export function useOrderHandlers(options: OrderHandlerOptions = {}): OrderBackend {
  const backend: OrderBackend = { lists: [], deletedLists: [], reads: [], writes: [] };
  const detailOf = async (id: string): Promise<OrderDetailFixture | Response> =>
    options.detail === undefined ? order0148 : resolve(options.detail, id);

  const written = async (request: Request, fallback: () => Response | Promise<Response>): Promise<Response> => {
    const url = new URL(request.url);
    const write: OrderWrite = {
      method: request.method as OrderWrite['method'],
      path: url.pathname.replace(/^.*\/api\/v1/, ''),
      body: await readBody(request),
      key: request.headers.get('Idempotency-Key'),
    };
    backend.writes.push(write);
    return (await options.reply?.(write)) ?? fallback();
  };

  const orderAnswer = (status: number) => async (): Promise<Response> => {
    const body = await detailOf(order0148.id);
    return body instanceof Response ? body : HttpResponse.json(body, { status });
  };
  const noContent = (): Response => new HttpResponse(null, { status: 204 });

  server.use(
    // The Orders toolbar's Product type filter reads the product types (plan 08-09).
    http.get('*/api/v1/product-types', () => HttpResponse.json(PRODUCT_TYPES)),
    http.get('*/api/v1/orders/deleted', async ({ request }) => {
      const url = new URL(request.url);
      backend.deletedLists.push(url);
      const body = await resolve(options.deleted ?? { items: [], total: 0, page: 1, pageSize: 20 }, url);
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.get('*/api/v1/orders', async ({ request }) => {
      const url = new URL(request.url);
      backend.lists.push(url);
      const body = await resolve(options.list ?? standardOrderList(), url);
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.get('*/api/v1/orders/:id', async ({ params }) => {
      const id = String(params.id);
      backend.reads.push(id);
      const body = await detailOf(id);
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
    http.post('*/api/v1/orders', ({ request }) => written(request, orderAnswer(201))),
    http.put('*/api/v1/orders/:id', ({ request }) => written(request, orderAnswer(200))),
    http.delete('*/api/v1/orders/:id', ({ request }) => written(request, noContent)),
    http.post('*/api/v1/orders/:id/status', ({ request }) => written(request, orderAnswer(200))),
    http.post('*/api/v1/orders/:id/restore', ({ request }) => written(request, noContent)),
    http.delete('*/api/v1/orders/:id/permanent', ({ request }) => written(request, noContent)),
    ...CHILD_KINDS.flatMap((kind) => [
      http.post(`*/api/v1/orders/:orderId/${kind}`, ({ request }) => written(request, orderAnswer(200))),
      http.put(`*/api/v1/orders/:orderId/${kind}/:childId`, ({ request }) => written(request, orderAnswer(200))),
      http.delete(`*/api/v1/orders/:orderId/${kind}/:childId`, ({ request }) => written(request, orderAnswer(200))),
    ]),
  );
  return backend;
}
