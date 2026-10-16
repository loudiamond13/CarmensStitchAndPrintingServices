// Sign-in helpers for the auth specs (AUTH-02, D-01, QUAL-05). Import them with `./fixtures.ts` and `./testing-api.ts`.
// Every test signs in with its own staff user (createStaff) and reads its own code from the Testing sink (D-27).
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from './fixtures.ts';
import { latestEmail, type SinkEmail, type TestStaff } from './testing-api.ts';

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
  // The e2e bundle lands on the dev preview at /admin; a production bundle goes on to /admin/sessions.
  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('main')).toBeVisible();
  return sessionUser;
}
