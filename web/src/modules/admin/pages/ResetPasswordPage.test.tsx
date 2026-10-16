import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { ResetPasswordRoute, tokenFromHash } from '@/modules/admin/pages/ResetPasswordPage';
import { acceptSession, clearSession, getSessionUser, takeSignInNotice } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// S5 Set a new password from the email link, /admin/reset-password#token=... (AUTH-08, AUTH-09, AUTH-11, A11Y-03; plan
// 04-28).

const TOKEN = 'abcDEF0123456789abcDEF0123456789abcDEF01234';
const EMAIL = 'paolo.garcia@gmail.com';
const GOOD = 'Mabuhay#Tahi2026';
const problem = { 'Content-Type': 'application/problem+json' };

interface Probe {
  /** The address hash the page had when each check request arrived. */
  hashAtCheck: string[];
  checkBodies: unknown[];
  resetBodies: unknown[];
  resetKeys: (string | null)[];
}

/** Answers the link check (default: usable, for EMAIL) and the reset (default: 204) and records what arrived. */
function answer(
  options: { check?: () => Response | Promise<Response>; reset?: () => Response | Promise<Response> } = {},
): Probe {
  const probe: Probe = { hashAtCheck: [], checkBodies: [], resetBodies: [], resetKeys: [] };
  server.use(
    http.post('*/api/v1/auth/password/reset/check', async ({ request }) => {
      probe.hashAtCheck.push(window.location.hash);
      probe.checkBodies.push(await request.json());
      return options.check
        ? options.check()
        : HttpResponse.json({ email: EMAIL, firstName: 'Paolo', lastName: 'Garcia' });
    }),
    http.post('*/api/v1/auth/password/reset', async ({ request }) => {
      probe.resetBodies.push(await request.json());
      probe.resetKeys.push(request.headers.get('Idempotency-Key'));
      return options.reset ? options.reset() : new HttpResponse(null, { status: 204 });
    }),
  );
  return probe;
}

function problemResponse(status: number, body: JsonBodyType = { title: 'No', status }): Response {
  return HttpResponse.json(body, { status, headers: problem });
}

function renderReset(hash: string | null = `#token=${TOKEN}`) {
  window.history.replaceState(null, '', `/admin/reset-password${hash ?? ''}`);
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/reset-password', Component: ResetPasswordRoute }],
      },
      { path: '/admin/login', element: <p>The sign-in page</p> },
      { path: '/admin/forgot-password', element: <p>The forgot page</p> },
    ],
    { initialEntries: ['/admin/reset-password'] },
  );
  return Object.assign(router, { view: render(<RouterProvider router={router} />) });
}

async function formReady(): Promise<void> {
  await screen.findByLabelText('New password');
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>, password = GOOD, confirm = password) {
  await user.type(screen.getByLabelText('New password'), password);
  if (confirm !== '') {
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
  }
  await user.click(screen.getByRole('button', { name: 'Save Password' }));
}

beforeEach(() => {
  clearSession();
  takeSignInNotice();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('tokenFromHash', () => {
  it.each([
    ['#token=abc', 'abc'],
    ['token=abc', 'abc'],
    ['#token=a%2Bb', 'a+b'],
    ['#other=1&token=abc', 'abc'],
    ['', null],
    ['#', null],
    ['#token=', null],
    ['#nottoken=abc', null],
  ])('reads %j as %j', (hash, expected) => {
    expect(tokenFromHash(hash)).toBe(expected);
  });
});

describe('S5 token handling and the checking state', () => {
  it('removes the token from the address bar before the check request, and sends it in the body', async () => {
    const probe = answer();
    renderReset();

    await formReady();

    expect(probe.hashAtCheck).toEqual(['']);
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);
    expect(probe.checkBodies).toEqual([{ token: TOKEN }]);
  });

  it('shows the invalid state at once, with no request, when there is no fragment', async () => {
    const probe = answer();
    renderReset(null);

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(probe.checkBodies).toEqual([]);
  });

  it('shows the invalid state at once when the fragment holds no token', async () => {
    const probe = answer();
    renderReset('#token=');

    expect(await screen.findByRole('heading', { level: 1, name: 'This link has expired' })).toBeInTheDocument();
    expect(probe.checkBodies).toEqual([]);
  });

  it('says "Checking your link…" with a skeleton, then "Link checked." when the form shows', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    answer({
      check: async () => {
        await gate;
        return HttpResponse.json({ email: EMAIL, firstName: 'Paolo', lastName: 'Garcia' });
      },
    });
    renderReset();

    expect(await screen.findByRole('heading', { level: 1, name: 'Set a new password' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your link…');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await act(async () => {
      release();
      await gate;
    });
    await formReady();
    expect(screen.getByRole('status')).toHaveTextContent('Link checked.');
  });

  it('shows the form with the account email in the subline and a hidden username input', async () => {
    answer();
    const { view } = renderReset();

    await formReady();

    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' &&
          node.textContent === `Choose a new password for ${EMAIL}. You'll sign in again after this.`,
      ),
    ).toBeInTheDocument();
    const username = view.container.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue(EMAIL);
    expect(username).not.toBeVisible();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(document.title).toBe('Set a new password · CSPS Admin');
    await expectNoAxeViolations(document.body);
  });
});

describe('S5 invalid and failed links', () => {
  it('shows one invalid state for a link the server refuses, with focus on the heading', async () => {
    answer({ check: () => problemResponse(404, { title: 'auth.link-invalid', status: 404 }) });
    renderReset();

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(
      screen.getByText("Reset links work for 30 minutes and only once. Ask for a new one and we'll email it to you."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a New Link' })).toHaveAttribute('href', '/admin/forgot-password');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('does not call a link expired when the check itself failed: it offers the check again', async () => {
    const user = userEvent.setup();
    let calls = 0;
    answer({
      check: () => {
        calls += 1;
        return calls === 1
          ? problemResponse(503, { title: 'Down', status: 503 })
          : HttpResponse.json({ email: EMAIL, firstName: 'Paolo', lastName: 'Garcia' });
      },
    });
    renderReset();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This link has expired' })).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await formReady();
    expect(calls).toBe(2);
  });
});

describe('S5 validation that mirrors the server (OR-3)', () => {
  it('shows a rule-specific message before any request and focuses the field', async () => {
    const user = userEvent.setup();
    const probe = answer();
    renderReset();
    await formReady();

    await fillAndSave(user, 'Pass1234', 'Pass1234');

    expect(await screen.findByText('Add at least one symbol, like ! or #.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(probe.resetBodies).toEqual([]);
    await expectNoAxeViolations(document.body);
  });

  it.each([
    ['email', 'Paolo.Garcia#2026'],
    ['first name', 'Paolo#Mabuhay2026'],
    ['last name', 'Garcia#Mabuhay2026'],
  ])('keeps the account %s out of the password, using the checked link', async (_part, password) => {
    const user = userEvent.setup();
    const probe = answer();
    renderReset();
    await formReady();

    await fillAndSave(user, password);

    expect(await screen.findByText("Don't use your name or email in your password.")).toBeInTheDocument();
    expect(probe.resetBodies).toEqual([]);
  });

  it('asks for the confirmation, and says when it does not match', async () => {
    const user = userEvent.setup();
    const probe = answer();
    renderReset();
    await formReady();

    await fillAndSave(user, GOOD, '');
    expect(await screen.findByText('Enter the new password again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveFocus();

    await user.type(screen.getByLabelText('Confirm new password'), 'Mabuhay#Tahi2027');
    await user.click(screen.getByRole('button', { name: 'Save Password' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(probe.resetBodies).toEqual([]);
  });
});

describe('S5 saving', () => {
  it("sends the token and password in the body with one Idempotency-Key, ends this tab's session and opens sign-in with the notice", async () => {
    const user = userEvent.setup();
    const probe = answer();
    acceptSession(sessionResponse());
    const router = renderReset();
    await formReady();

    await fillAndSave(user);

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(probe.resetBodies).toEqual([{ token: TOKEN, newPassword: GOOD }]);
    expect(probe.resetKeys[0]).toMatch(/\S/);
    expect(takeSignInNotice()).toBe('password-changed');
    expect(getSessionUser()).toBeNull();
  });

  it("shows the server's message under New password and moves focus there", async () => {
    const user = userEvent.setup();
    answer({
      reset: () =>
        problemResponse(400, {
          title: 'Check the highlighted fields.',
          status: 400,
          errors: { NewPassword: ['This password has appeared in a data breach. Choose a different one.'] },
        }),
    });
    renderReset();
    await formReady();

    await fillAndSave(user, 'Pwned#Pass2026');

    expect(
      await screen.findByText('This password has appeared in a data breach. Choose a different one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations(document.body);
  });

  it('turns to the invalid state when the link stopped working between the check and the save', async () => {
    const user = userEvent.setup();
    answer({ reset: () => problemResponse(404, { title: 'auth.link-invalid', status: 404 }) });
    renderReset();
    await formReady();

    await fillAndSave(user);

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it('shows the shared banner for a failure that is not the password, and keeps what was typed', async () => {
    const user = userEvent.setup();
    answer({ reset: () => problemResponse(429, { title: 'Slow down', status: 429 }) });
    renderReset();
    await formReady();

    await fillAndSave(user);

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('Too many tries')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
    expect(window.location.hash).toBe('');
  });
});
