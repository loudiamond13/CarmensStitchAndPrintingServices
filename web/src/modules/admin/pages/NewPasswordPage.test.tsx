import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { NewPasswordRoute } from '@/modules/admin/pages/NewPasswordPage';
import {
  clearSession,
  getSessionUser,
  takeSignedInToast,
  takeSignInNotice,
} from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// S3 Set a new password, the must-change step, /admin/login/new-password (D-13, D-18, D-22, AUTH-09, A11Y-03; plan 04-31).

const EMAIL = 'lito.ramos@gmail.com';
const CONTEXT = { email: EMAIL, firstName: 'Lito', lastName: 'Ramos', reason: 'temporary' };
const GOOD = 'Mabuhay#Tahi2026';
const problem = { 'Content-Type': 'application/problem+json' };

interface Probe {
  bodies: unknown[];
  csrfHeaders: (string | null)[];
}

/** Answers the must-change check (default: the usable pending sign-in for EMAIL); the last answer set wins. */
function answerCheck(reply?: () => Response | Promise<Response>): { calls: () => number } {
  let calls = 0;
  server.use(
    http.post('*/api/v1/auth/password/set-new/check', () => {
      calls += 1;
      return reply ? reply() : HttpResponse.json(CONTEXT);
    }),
  );
  return { calls: () => calls };
}

async function formReady(): Promise<void> {
  await screen.findByLabelText('New password');
}

/** Answers set-new (default: 200 with a session) and records what arrived. */
function answer(reply?: () => Response | Promise<Response>): Probe {
  const probe: Probe = { bodies: [], csrfHeaders: [] };
  server.use(
    http.post('*/api/v1/auth/password/set-new', async ({ request }) => {
      probe.bodies.push(await request.json());
      probe.csrfHeaders.push(request.headers.get('X-CSPS-CSRF'));
      return reply ? reply() : HttpResponse.json(sessionResponse());
    }),
  );
  return probe;
}

function problemResponse(status: number, body: JsonBodyType = { title: 'No', status }): Response {
  return HttpResponse.json(body, { status, headers: problem });
}

function renderNewPassword(entry = '/admin/login/new-password') {
  const router = createMemoryRouter(
    [
      { Component: AuthLayout, children: [{ path: '/admin/login/new-password', Component: NewPasswordRoute }] },
      { path: '/admin/login', element: <p>The sign-in page</p> },
      { path: '/admin', element: <p>The admin shell</p> },
      { path: '/admin/orders', element: <p>The orders page</p> },
    ],
    { initialEntries: [entry] },
  );
  return Object.assign(router, { view: render(<RouterProvider router={router} />) });
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
  takeSignedInToast();
  answerCheck();
});

describe('S3 arrival', () => {
  it('checks the pending sign-in first, then shows the temporary subline, focuses New password and passes axe', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    answerCheck(async () => {
      await gate;
      return HttpResponse.json(CONTEXT);
    });
    renderNewPassword();

    expect(await screen.findByRole('heading', { level: 1, name: 'Set a new password' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your sign-in…');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await act(async () => {
      release();
      await gate;
    });
    await formReady();

    expect(screen.getByRole('status')).toHaveTextContent('Sign-in checked.');
    expect(
      screen.getByText('You signed in with a temporary password. Choose your own password to continue.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password');
    expect(document.title).toBe('Set a new password · CSPS Admin');
    await expectNoAxeViolations(document.body);
  });

  it('shows the breach subline (D-18) when the check says breach', async () => {
    answerCheck(() => HttpResponse.json({ ...CONTEXT, reason: 'breach' }));
    renderNewPassword();
    await formReady();

    expect(screen.getByText('Your password appeared in a data breach. Set a new one.')).toBeInTheDocument();
    expect(screen.queryByText(/temporary password/)).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('puts the email from the check in the hidden username input, with nothing held in memory (a reloaded page)', async () => {
    const { view } = renderNewPassword();
    await formReady();

    const username = view.container.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue(EMAIL);
    expect(username).not.toBeVisible();
  });

  it('sends the person to sign-in with the timed-out notice when the check says the sign-in is gone', async () => {
    answerCheck(() => problemResponse(401, { title: 'Sign in again', status: 401, code: 'auth.ticket-expired' }));
    const router = renderNewPassword();

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(takeSignInNotice()).toBe('timed-out');
    expect(getSessionUser()).toBeNull();
  });

  it('does not treat a failed check as a timed-out sign-in: it offers the check again', async () => {
    const user = userEvent.setup();
    let calls = 0;
    answerCheck(() => {
      calls += 1;
      return calls === 1 ? problemResponse(503, { title: 'Down', status: 503 }) : HttpResponse.json(CONTEXT);
    });
    renderNewPassword();

    expect(await screen.findByText('We could not check your sign-in yet.')).toBeInTheDocument();
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(takeSignInNotice()).toBeNull();
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await formReady();
    expect(calls).toBe(2);
  });
});

describe('S3 validation that mirrors the server (OR-3)', () => {
  it('shows a rule-specific message and a mismatch message before any request', async () => {
    const user = userEvent.setup();
    const probe = answer();
    renderNewPassword();
    await formReady();

    await fillAndSave(user, 'Pass1234', 'Pass1234');
    expect(await screen.findByText('Add at least one symbol, like ! or #.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('New password'), GOOD);
    await user.type(screen.getByLabelText('Confirm new password'), 'Mabuhay#Tahi2027');
    await user.click(screen.getByRole('button', { name: 'Save Password' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(probe.bodies).toEqual([]);
  });

  it.each([
    ['email', 'Lito.Ramos#2026'],
    ['first name', 'Lito#Mabuhay2026'],
    ['last name', 'Ramos#Mabuhay2026'],
  ])('keeps the account %s from the check out of the password', async (_part, password) => {
    const user = userEvent.setup();
    const probe = answer();
    renderNewPassword();
    await formReady();

    await fillAndSave(user, password);

    expect(await screen.findByText("Don't use your name or email in your password.")).toBeInTheDocument();
    expect(probe.bodies).toEqual([]);
  });
});

describe('S3 saving', () => {
  it('sends only the password, starts the session, leaves the toast for the shell and opens /admin', async () => {
    const user = userEvent.setup();
    const probe = answer();
    const router = renderNewPassword();
    await formReady();

    await fillAndSave(user);

    expect(await screen.findByText('The admin shell')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
    expect(probe.bodies).toEqual([{ newPassword: GOOD }]);
    expect(probe.csrfHeaders[0]).toBe('1');
    expect(getSessionUser()?.name).toBe('Carmen Reyes');
    expect(takeSignedInToast()).toBe('password-saved');
  });

  it('goes to the validated return path, and to /admin when the path is not safe', async () => {
    const user = userEvent.setup();
    answer();
    const router = renderNewPassword('/admin/login/new-password?returnUrl=%2Fadmin%2Forders');
    await formReady();

    await fillAndSave(user);

    expect(await screen.findByText('The orders page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/orders');
  });

  it('a 401 means the sign-in timed out: the notice is set and S1 opens, with no session', async () => {
    const user = userEvent.setup();
    answer(() => problemResponse(401, { title: 'Sign in again', status: 401, code: 'auth.ticket-expired' }));
    const router = renderNewPassword();
    await formReady();

    await fillAndSave(user);

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(takeSignInNotice()).toBe('timed-out');
    expect(getSessionUser()).toBeNull();
    expect(takeSignedInToast()).toBeNull();
  });

  it("shows the server's message under New password and moves focus there", async () => {
    const user = userEvent.setup();
    answer(() =>
      problemResponse(400, {
        title: 'Check the highlighted fields.',
        status: 400,
        errors: { NewPassword: ['This password has appeared in a data breach. Choose a different one.'] },
      }),
    );
    renderNewPassword();
    await formReady();

    await fillAndSave(user, 'Pwned#Pass2026');

    expect(
      await screen.findByText('This password has appeared in a data breach. Choose a different one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations(document.body);
  });

  it('shows the shared banner for a failure that is not the password, and keeps what was typed', async () => {
    const user = userEvent.setup();
    answer(() => problemResponse(429, { title: 'Slow down', status: 429 }));
    renderNewPassword();
    await formReady();

    await fillAndSave(user);

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('Too many tries')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
    await expectNoAxeViolations(document.body);
  });

  it('"Use a different account" abandons the step: back to S1 and what this tab held is dropped', async () => {
    const user = userEvent.setup();
    const router = renderNewPassword();
    await formReady();

    expect(screen.getByRole('link', { name: 'Use a different account' })).toHaveAttribute('href', '/admin/login');
    await user.click(screen.getByRole('link', { name: 'Use a different account' }));

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(getSessionUser()).toBeNull();
  });
});
