// Sign-in helpers for the auth specs (AUTH-02, D-01, QUAL-05). Import them with `./fixtures.ts` and `./testing-api.ts`.
// Every test signs in with its own staff user (createStaff) and reads its own code from the Testing sink (D-27).
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test, type Guard } from './fixtures.ts';
import { createStaff, latestEmail, type SinkEmail, type StaffRole, type TestStaff } from './testing-api.ts';

/** The subject of the sign-in code email: "123456 is your CSPS sign-in code". */
const CODE_SUBJECT = 'is your CSPS sign-in code';

/** Who the server said signed in (the verify answer's user). */
export interface SignedInUser {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
}

export interface SignInOptions {
  /** Tick "Keep me signed in" on S1. Default false. */
  readonly keepSignedIn?: boolean;
}

/**
 * Signs a fresh staff user in (a Manager unless told otherwise); the sign-in lands on the dashboard. The Component Showcase repeats
 * the shell's parts as demos, so a shell check that needs one topbar, one menu or one drawer runs on this real page. Opening the
 * sign-in page asks the refresh cookie for a session first, and with none that answer is a 401.
 */
export async function signInFreshStaff(
  page: Page,
  request: APIRequestContext,
  guard: Guard,
  role: StaffRole = 'Manager',
): Promise<SignedInUser> {
  // A sign-in takes several seconds on a busy machine, on top of what the spec itself does.
  test.setTimeout(Math.max(test.info().timeout, 90_000));
  guard.expectStatus('/api/v1/auth/refresh', 401);
  return signInAs(page, request, await createStaff(request, role));
}

/** The dashboard h1 of a person: "Good morning, Carmen". The part of the day depends on the server clock, so any of the three matches. */
export function dashboardHeading(user: Pick<SignedInUser, 'firstName'>): RegExp {
  const name = user.firstName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`^Good (morning|afternoon|evening), ${name}$`);
}

/** The six digits from the subject of a sign-in code email. */
export function codeFromEmail(email: SinkEmail): string {
  const match = /^(\d{6}) is your CSPS sign-in code$/.exec(email.subject);
  if (match?.[1] === undefined) {
    throw new Error(`The email "${email.subject}" is not a sign-in code email.`);
  }
  return match[1];
}

function isSignedInUser(value: unknown): value is SignedInUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'email' in value &&
    typeof value.email === 'string' &&
    'firstName' in value &&
    typeof value.firstName === 'string' &&
    'lastName' in value &&
    typeof value.lastName === 'string' &&
    'role' in value &&
    typeof value.role === 'string'
  );
}

/** Types a code into the six boxes from the first one, as a person would. */
export async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type(code);
}

/**
 * Signs in through S1 and S2: opens /admin/login, types the email and password, reads the code from the sink, types
 * it and presses Verify Code. Resolves when the admin shell is showing, with the user the server named.
 * The page is not expected to have a session; a failed response in the flow is a guard finding as usual.
 */
export async function signInAs(
  page: Page,
  request: APIRequestContext,
  staff: TestStaff,
  options: SignInOptions = {},
): Promise<SignedInUser> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password', { exact: true }).fill(staff.password);
  if (options.keepSignedIn === true) {
    // The label carries an invisible 44px tap area (OQ-5) over the box, so the click goes to the label, as a finger's would.
    await page.locator('label', { hasText: 'Keep me signed in' }).click();
    await expect(page.getByRole('checkbox', { name: 'Keep me signed in' })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
  const mail = await latestEmail(request, staff.email, { subject: CODE_SUBJECT });
  const verified = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/two-factor/verify'));
  await typeCode(page, codeFromEmail(mail));
  await page.getByRole('button', { name: 'Verify Code' }).click();

  const body: unknown = await (await verified).json();
  const user = typeof body === 'object' && body !== null && 'session' in body ? body.session : null;
  const sessionUser = typeof user === 'object' && user !== null && 'user' in user ? user.user : null;
  if (!isSignedInUser(sessionUser)) {
    throw new Error('The verify answer carried no signed-in user.');
  }
  // Every bundle, the e2e one included, lands on the dashboard at /admin (DASH-01).
  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('main')).toBeVisible();
  // The greeting shows once the dashboard summary has arrived. A spec that goes straight on to another page would cancel that
  // request in flight, which WebKit reports as a page error, so wait for it here.
  if (new URL(page.url()).pathname === '/admin') {
    await expect(page.locator('h1')).toHaveText(dashboardHeading(sessionUser));
  }
  return sessionUser;
}
