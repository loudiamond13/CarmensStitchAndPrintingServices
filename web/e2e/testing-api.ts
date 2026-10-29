// Helpers for the Testing-only API routes (QUAL-05, D-37). They exist only on the E2E host, which runs in the Testing
// environment of a Debug build. Every test makes its own staff user, so the resend cooldown, caps and lockouts of one
// test never reach another (Pitfall 8). Mail is read from the sink; nothing is ever sent (D-27).
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures.ts';

export type StaffRole = 'Admin' | 'Manager';
export type StaffState = 'active' | 'deactivated' | 'manager-locked' | 'must-change-temporary' | 'must-change-breach';

/** A staff user made for one test. The password is shown here once. */
export interface TestStaff {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
}

/** An invited staff member made for one test: no password yet, and the raw token of the invite link. */
export interface InvitedStaff {
  readonly userId: string;
  readonly email: string;
  readonly inviteToken: string;
}

/** One email the sink received. */
export interface SinkEmail {
  readonly id: number;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly sentAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTestStaff(value: unknown): value is TestStaff {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    typeof value.email === 'string' &&
    typeof value.password === 'string'
  );
}

function isInvitedStaff(value: unknown): value is InvitedStaff {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    typeof value.email === 'string' &&
    typeof value.inviteToken === 'string'
  );
}

function isSinkEmail(value: unknown): value is SinkEmail {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.to === 'string' &&
    typeof value.subject === 'string' &&
    typeof value.text === 'string' &&
    typeof value.html === 'string' &&
    typeof value.sentAt === 'string'
  );
}

/** Optional identity for a made staff user: names up to 100 characters, an address under csps.test up to 256 (long-text specs). */
export interface StaffIdentity {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
}

/** Creates a fresh staff user (random email under csps.test, random password) for one test. */
export async function createStaff(
  request: APIRequestContext,
  role: StaffRole,
  state?: StaffState,
  identity: StaffIdentity = {},
): Promise<TestStaff> {
  const response = await request.post('/api/testing/staff', { data: { role, state, ...identity } });
  expect(response.status(), 'POST /api/testing/staff').toBe(201);
  const body: unknown = await response.json();
  if (!isTestStaff(body)) {
    throw new Error('POST /api/testing/staff returned an unexpected body.');
  }
  return body;
}

/** Creates a fresh invited staff user (state `invited`): no password, and the token an emailed invite link would carry. */
export async function createInvitedStaff(request: APIRequestContext, role: StaffRole): Promise<InvitedStaff> {
  const response = await request.post('/api/testing/staff', { data: { role, state: 'invited' } });
  expect(response.status(), 'POST /api/testing/staff (invited)').toBe(201);
  const body: unknown = await response.json();
  if (!isInvitedStaff(body)) {
    throw new Error('POST /api/testing/staff (invited) returned an unexpected body.');
  }
  return body;
}

/** What a spec chooses for a seeded company expense. The recorder is the person shown as Recorded by; leave it out for System. */
export interface ExpenseSeedInput {
  readonly paidByUserId: string;
  readonly recordedByUserId?: string;
  /** The expense date as yyyy-MM-dd. */
  readonly date: string;
  readonly categoryId: string;
  readonly description: string;
  readonly amount: number;
  readonly notes?: string;
  /** True to seed the expense already soft-deleted. */
  readonly deleted?: boolean;
}

/** Seeds one company expense with a chosen payer, recorder, date and delete state, and returns its id. */
export async function createExpense(request: APIRequestContext, input: ExpenseSeedInput): Promise<string> {
  const response = await request.post('/api/testing/expenses', { data: input });
  expect(response.status(), 'POST /api/testing/expenses').toBe(201);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.id !== 'string') {
    throw new Error('POST /api/testing/expenses returned an unexpected body.');
  }
  return body.id;
}

/** The seeded Basketball Jersey product type (the id is the fixed migration seed literal). */
export const BASKETBALL_JERSEY_ID = '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6';

/** One line of a seeded order. */
export interface OrderSeedItem {
  readonly productTypeId: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly sizeVariant?: string;
}

/** One payment of a seeded order. The method is a payment method id; the receiver is a staff user id. */
export interface OrderSeedPayment {
  /** The payment date as yyyy-MM-dd. */
  readonly paymentDate: string;
  readonly amount: number;
  readonly paymentMethodId: string;
  readonly receivedByUserId: string;
  readonly reference?: string;
  readonly notes?: string;
}

/** One order expense of a seeded order. The category is an order expense category id; the payer is a staff user id. */
export interface OrderSeedExpense {
  /** The expense date as yyyy-MM-dd. */
  readonly expenseDate: string;
  readonly amount: number;
  readonly orderExpenseCategoryId: string;
  readonly paidByUserId: string;
  readonly description?: string;
}

/** One discount of a seeded order. */
export interface OrderSeedDiscount {
  readonly kind: 'percentage' | 'fixed';
  readonly value: number;
  readonly reason: string;
}

/**
 * What a spec chooses for a seeded order (POST /api/testing/orders, the member names of the create call plus `number`).
 * Only the number and the items are needed; the server works out every figure.
 */
export interface OrderSeedInput {
  /** The order number, kept as given; use a unique one per run. */
  readonly number: string;
  /** pending, mockup, production, ready, delivered, completed or cancelled; pending when left out. */
  readonly status?: string;
  readonly customerName?: string;
  readonly teamName?: string;
  readonly contactNumber?: string;
  readonly email?: string;
  readonly address?: string;
  /** The order date as yyyy-MM-dd; the business today when left out. */
  readonly orderDate?: string;
  /** The due date as yyyy-MM-dd. */
  readonly dueDate?: string;
  readonly notes?: string;
  readonly items: readonly OrderSeedItem[];
  readonly discounts?: readonly OrderSeedDiscount[];
  readonly payments?: readonly OrderSeedPayment[];
  readonly expenses?: readonly OrderSeedExpense[];
}

/** Seeds one order through the legacy import path with a chosen number, status and lines, and returns its id. */
export async function createOrder(request: APIRequestContext, input: OrderSeedInput): Promise<string> {
  const response = await request.post('/api/testing/orders', { data: input });
  expect(response.status(), 'POST /api/testing/orders').toBe(201);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.id !== 'string') {
    throw new Error('POST /api/testing/orders returned an unexpected body.');
  }
  return body.id;
}

/** Reads the sink's mail after a cursor id, optionally for one address. Oldest first. */
export async function readEmails(
  request: APIRequestContext,
  options: { readonly to?: string; readonly after?: number } = {},
): Promise<SinkEmail[]> {
  const params: Record<string, string | number> = { after: options.after ?? 0 };
  if (options.to !== undefined) {
    params.to = options.to;
  }
  const response = await request.get('/api/testing/emails', { params });
  expect(response.status(), 'GET /api/testing/emails').toBe(200);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isSinkEmail)) {
    throw new Error('GET /api/testing/emails returned an unexpected body.');
  }
  return body;
}

/** Waits up to 15 seconds for mail to an address (optionally with a subject part, after a cursor id) and returns the newest match. */
export async function latestEmail(
  request: APIRequestContext,
  to: string,
  options: { readonly subject?: string; readonly after?: number } = {},
): Promise<SinkEmail> {
  const found: { email: SinkEmail | undefined } = { email: undefined };
  await expect
    .poll(
      async () => {
        const messages = await readEmails(request, { to, after: options.after ?? 0 });
        found.email = messages
          .filter((message) => options.subject === undefined || message.subject.includes(options.subject))
          .at(-1);
        return found.email !== undefined;
      },
      { timeout: 15_000, message: `No email to ${to} arrived in the sink.` },
    )
    .toBe(true);
  if (found.email === undefined) {
    throw new Error(`No email to ${to} arrived in the sink.`);
  }
  return found.email;
}
