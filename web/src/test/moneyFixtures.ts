// Money fixtures for component, service and route tests (plan 10-13): the caller's own money on hand typed from the generated
// contract, with made-up people, and an MSW handler that records every request to GET /api/v1/staff-money/me.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type MyMoneyFixture = Schemas['StaffMoneyResponse'];

/** The made-up person of the money fixtures (a made-up account id; the same shape as the sections test uses). */
export const MY_MONEY_USER_ID = '0b0f6c1e-0000-4000-8000-000000000001';

/** A staff member holding 8,450.00 on a November day. Override any field. */
export function myMoneyFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return {
    userId: MY_MONEY_USER_ID,
    name: 'Liza Mercado',
    role: 'Admin',
    status: 'active',
    balance: 8450,
    today: '2026-11-04',
    ...overrides,
  };
}

/** A staff member who spent more than they hold: 500.00 below zero (D-15, D-16). */
export function myMoneyNegativeFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return myMoneyFixture({ balance: -500, ...overrides });
}

/** A staff member holding nothing. */
export function myMoneyZeroFixture(overrides: Partial<MyMoneyFixture> = {}): MyMoneyFixture {
  return myMoneyFixture({ balance: 0, ...overrides });
}

type MyMoneyResponder = (url: URL) => Response | MyMoneyFixture | Promise<Response | MyMoneyFixture>;

/**
 * Answers `GET /api/v1/staff-money/me` with a fixture, or with a function that decides per call (a failure is a Response).
 * Returns every request made. A handler added later wins over an earlier one, so call this after `dashboardBackend` to replace
 * the default answer it registers.
 */
export function myMoneyBackend(answer: MyMoneyFixture | MyMoneyResponder = myMoneyFixture()): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/staff-money/me', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return calls;
}

// The transfer window's fixtures (plan 10-15): the people it offers, a saved transfer, and handlers that record what the browser sends.

export type TransferRecipientFixture = Schemas['TransferRecipientResponse'];
export type TransferSavedFixture = Schemas['MoneyTransferSavedResponse'];

export const LIZA_ID = '0b0f6c1e-0000-4000-8000-000000000002';
export const PAOLO_ID = '0b0f6c1e-0000-4000-8000-000000000003';
export const JOMAR_ID = '0b0f6c1e-0000-4000-8000-000000000004';
export const ANA_ID = '0b0f6c1e-0000-4000-8000-000000000005';

/** What the recipients list answers for the signed-in Carmen: herself (marked), two coworkers, a deactivated and a deleted leaver. */
export function transferRecipientsFixture(): TransferRecipientFixture[] {
  return [
    { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', status: 'active', isYou: true },
    { id: LIZA_ID, name: 'Liza Mercado', status: 'active', isYou: false },
    { id: PAOLO_ID, name: 'Paolo Garcia', status: 'active', isYou: false },
    { id: JOMAR_ID, name: 'Jomar Santos', status: 'deactivated', isYou: false },
    { id: ANA_ID, name: 'Ana Villanueva', status: 'deleted', isYou: false },
  ];
}

type RecipientsResponder = (
  url: URL,
) => Response | TransferRecipientFixture[] | Promise<Response | TransferRecipientFixture[]>;

/** Answers `GET /api/v1/money-transfers/recipients` and returns every request made. A later call overrides an earlier one. */
export function transferRecipientsBackend(
  answer: TransferRecipientFixture[] | RecipientsResponder = transferRecipientsFixture(),
): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/money-transfers/recipients', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return calls;
}

/** A saved transfer of 2,000.00 from Carmen to Liza, and Carmen's new balance. */
export function transferSavedFixture(overrides: Partial<TransferSavedFixture> = {}): TransferSavedFixture {
  return {
    senderBalance: 6450,
    transfer: {
      id: '0b0f6c1e-0000-4000-8000-0000000000a1',
      amount: 2000,
      from: { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', formerStaff: false },
      to: { id: LIZA_ID, name: 'Liza Mercado', formerStaff: false },
      transferDate: '2026-11-04',
      note: null,
      isDeleted: false,
      isHandover: false,
      deletedAtUtc: null,
      deletedBy: null,
      recordedAtUtc: '2026-11-04T02:00:00Z',
      recordedBy: { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', formerStaff: false },
      version: 'AAAAAAAAB9E=',
    },
    ...overrides,
  };
}

/** What the fake API received for each transfer: the JSON body and the Idempotency-Key header. */
export interface TransferCalls {
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers `POST /api/v1/money-transfers` (201 with the saved transfer unless told otherwise) and records body and key. */
export function createTransferBackend(
  reply: () => Response | Promise<Response> = () => HttpResponse.json(transferSavedFixture(), { status: 201 }),
): TransferCalls {
  const calls: TransferCalls = { bodies: [], keys: [] };
  server.use(
    http.post('*/api/v1/money-transfers', async ({ request }) => {
      calls.bodies.push(await request.json());
      calls.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return calls;
}

/** A 400 with a message under one field, in the server's problem shape (code and the errors by field). */
export function transferFieldProblem(field: string, message: string): Response {
  return new HttpResponse(
    JSON.stringify({
      title: 'Check the highlighted fields.',
      status: 400,
      code: 'money-transfers.invalid-request',
      errors: { [field]: [message] },
    }),
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** A 409 busy in the server's problem shape: its `detail` is the server's own line. */
export function transferBusyProblem(): Response {
  return new HttpResponse(
    JSON.stringify({
      title: 'Conflict',
      status: 409,
      code: 'money-transfers.busy',
      detail: 'Something changed at the same time. Try again.',
    }),
    { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

// The ledger's fixtures (plan 10-17): one page with every kind of row, a hand-over, a deleted transfer and a negative running balance,
// typed from the generated contract, with made-up people; and an MSW handler that records every request to the ledger route.

export type LedgerEntryFixture = Schemas['LedgerEntryResponse'];
export type LedgerPageFixture = Schemas['LedgerPageResponse'];

export const LEDGER_ORDER_ID = '0b0f6c1e-0000-4000-8000-0000000000b1';
export const LEDGER_TRANSFER_ID = '0b0f6c1e-0000-4000-8000-0000000000c1';

const CARMEN: Schemas['ActorRef'] = { id: MY_MONEY_USER_ID, name: 'Carmen Reyes', formerStaff: false };
const PAOLO: Schemas['ActorRef'] = { id: PAOLO_ID, name: 'Paolo Garcia', formerStaff: false };
const LIZA: Schemas['ActorRef'] = { id: LIZA_ID, name: 'Liza Mercado', formerStaff: false };

/** A row with every detail empty; override what the kind names. A row has money in or money out, never both. */
export function ledgerEntryFixture(overrides: Partial<LedgerEntryFixture> = {}): LedgerEntryFixture {
  return {
    kind: 'payment-received',
    date: '2026-10-28',
    recordedAtUtc: '2026-10-28T02:00:00Z',
    moneyIn: 2000,
    moneyOut: null,
    balanceAfter: 2000,
    orderId: null,
    orderNumber: null,
    team: null,
    customer: null,
    paymentMethod: null,
    category: null,
    description: null,
    counterpart: null,
    note: null,
    transferId: null,
    version: null,
    isHandover: false,
    recordedBy: null,
    isDeleted: false,
    deletedBy: null,
    deletedAtUtc: null,
    ...overrides,
  };
}

/**
 * The six kinds, newest first, with balances that add up from the oldest row (2,000.00) to the newest (−500.00): a payment, a refund,
 * a transfer in with a note, a hand-over transfer out, a company expense and an order expense. The balance on hand is −500.00.
 */
export function ledgerEntriesFixture(): LedgerEntryFixture[] {
  return [
    ledgerEntryFixture({
      kind: 'order-expense',
      date: '2026-11-04',
      recordedAtUtc: '2026-11-04T05:00:00Z',
      moneyIn: null,
      moneyOut: 1450,
      balanceAfter: -500,
      orderId: LEDGER_ORDER_ID,
      orderNumber: 'ORD-2026-0148',
      category: 'Fabric',
      description: 'Extra dye lot',
    }),
    ledgerEntryFixture({
      kind: 'company-expense',
      date: '2026-11-03',
      recordedAtUtc: '2026-11-03T05:00:00Z',
      moneyIn: null,
      moneyOut: 750,
      balanceAfter: 950,
      category: 'Utilities',
      description: 'Electric bill for October',
    }),
    ledgerEntryFixture({
      kind: 'transfer-out',
      date: '2026-11-02',
      recordedAtUtc: '2026-11-02T05:00:00Z',
      moneyIn: null,
      moneyOut: 2000,
      balanceAfter: 1700,
      counterpart: LIZA,
      transferId: LEDGER_TRANSFER_ID,
      version: 'AAAAAAAAB9E=',
      isHandover: true,
      recordedBy: CARMEN,
    }),
    ledgerEntryFixture({
      kind: 'transfer-in',
      date: '2026-11-01',
      recordedAtUtc: '2026-11-01T05:00:00Z',
      moneyIn: 2000,
      moneyOut: null,
      balanceAfter: 3700,
      counterpart: PAOLO,
      note: 'Cash for the fabric run',
      transferId: '0b0f6c1e-0000-4000-8000-0000000000c2',
      version: 'AAAAAAAAB9F=',
      recordedBy: PAOLO,
    }),
    ledgerEntryFixture({
      kind: 'refund-handed-back',
      date: '2026-10-30',
      recordedAtUtc: '2026-10-30T05:00:00Z',
      moneyIn: null,
      moneyOut: 300,
      balanceAfter: 1700,
      orderId: LEDGER_ORDER_ID,
      orderNumber: 'ORD-2026-0148',
      team: 'Blue Hawks',
      customer: 'Rico Dela Cruz',
    }),
    ledgerEntryFixture({
      kind: 'payment-received',
      date: '2026-10-28',
      recordedAtUtc: '2026-10-28T02:00:00Z',
      moneyIn: 2000,
      balanceAfter: 2000,
      orderId: LEDGER_ORDER_ID,
      orderNumber: 'ORD-2026-0148',
      team: 'Blue Hawks',
      customer: 'Rico Dela Cruz',
      paymentMethod: 'GCash',
    }),
  ];
}

/** A deleted transfer: its face amount, no balance after it, and who deleted it and when (the Manager's Show deleted view). */
export function ledgerDeletedEntryFixture(overrides: Partial<LedgerEntryFixture> = {}): LedgerEntryFixture {
  return ledgerEntryFixture({
    kind: 'transfer-out',
    date: '2026-10-06',
    recordedAtUtc: '2026-10-06T05:00:00Z',
    moneyIn: null,
    moneyOut: 2000,
    balanceAfter: null,
    counterpart: LIZA,
    transferId: '0b0f6c1e-0000-4000-8000-0000000000c3',
    version: 'AAAAAAAAB9G=',
    isDeleted: true,
    deletedBy: CARMEN,
    deletedAtUtc: '2026-10-08T07:42:00Z',
    recordedBy: CARMEN,
    ...overrides,
  });
}

/** A ledger page. The total, page and size follow the rows unless overridden; the balance is the newest row's. */
export function ledgerPageFixture(
  items: LedgerEntryFixture[] = ledgerEntriesFixture(),
  overrides: Partial<LedgerPageFixture> = {},
): LedgerPageFixture {
  return {
    balance: -500,
    includesDeleted: false,
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    ...overrides,
  };
}

type LedgerResponder = (url: URL) => Response | LedgerPageFixture | Promise<Response | LedgerPageFixture>;

/** Answers `GET /api/v1/staff-money/me/ledger` with a page, or with a function that decides per call. Returns every request made. */
export function ledgerBackend(answer: LedgerPageFixture | LedgerResponder = ledgerPageFixture()): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/staff-money/me/ledger', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return calls;
}
