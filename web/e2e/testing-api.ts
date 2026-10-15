// Helpers for the Testing-only API routes (QUAL-05, D-37). They exist only on the E2E host, which runs in the Testing
// environment of a Debug build. Every test makes its own staff user, so the resend cooldown, caps and lockouts of one
// test never reach another (Pitfall 8). Mail is read from the sink; nothing is ever sent (D-27).
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures.ts';

export type StaffRole = 'Admin' | 'Manager';
export type StaffState = 'active' | 'deactivated';

/** A staff user made for one test. The password is shown here once. */
export interface TestStaff {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
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

/** Creates a fresh staff user (random email under csps.test, random password) for one test. */
export async function createStaff(request: APIRequestContext, role: StaffRole, state?: StaffState): Promise<TestStaff> {
  const response = await request.post('/api/testing/staff', { data: { role, state } });
  expect(response.status(), 'POST /api/testing/staff').toBe(201);
  const body: unknown = await response.json();
  if (!isTestStaff(body)) {
    throw new Error('POST /api/testing/staff returned an unexpected body.');
  }
  return body;
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

/** Waits up to 15 seconds for mail to an address (optionally with a subject part) and returns the newest match. */
export async function latestEmail(
  request: APIRequestContext,
  to: string,
  options: { readonly subject?: string } = {},
): Promise<SinkEmail> {
  const found: { email: SinkEmail | undefined } = { email: undefined };
  await expect
    .poll(
      async () => {
        const messages = await readEmails(request, { to });
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
