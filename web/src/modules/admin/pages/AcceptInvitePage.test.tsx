import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { AcceptInviteRoute } from '@/modules/admin/pages/AcceptInvitePage';
import { clearSession, takeSignInNotice } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// S6 Set your password from an invite, /admin/accept-invite#token=... (AUTH-12, AUTH-11, A11Y-03, D-14, D-29; plan 04-31).

const TOKEN = 'abcDEF0123456789abcDEF0123456789abcDEF01234';
const EMAIL = 'ana.dizon@gmail.com';
const GOOD = 'Mabuhay#Tahi2026';
const problem = { 'Content-Type': 'application/problem+json' };

interface Probe {
  /** The address hash the page had when each check request arrived. */
  hashAtCheck: string[];
  checkBodies: unknown[];
  acceptBodies: unknown[];
  acceptKeys: (string | null)[];
}

/** Answers the invite check (default: usable, for EMAIL and "Ana") and the accept (default: 204) and records what arrived. */
function answer(
  options: { check?: () => Response | Promise<Response>; accept?: () => Response | Promise<Response> } = {},
): Probe {
  const probe: Probe = { hashAtCheck: [], checkBodies: [], acceptBodies: [], acceptKeys: [] };
  server.use(
    http.post('*/api/v1/auth/invite/check', async ({ request }) => {
      probe.hashAtCheck.push(window.location.hash);
      probe.checkBodies.push(await request.json());
      return options.check ? options.check() : HttpResponse.json({ email: EMAIL, firstName: 'Ana' });
    }),
    http.post('*/api/v1/auth/invite/accept', async ({ request }) => {
      probe.acceptBodies.push(await request.json());
      probe.acceptKeys.push(request.headers.get('Idempotency-Key'));
      return options.accept ? options.accept() : new HttpResponse(null, { status: 204 });
    }),
  );
  return probe;
}

function problemResponse(status: number, body: JsonBodyType = { title: 'No', status }): Response {
  return HttpResponse.json(body, { status, headers: problem });
}

const breachDown = () =>
  problemResponse(422, { title: 'Breach check unavailable', status: 422, code: 'auth.breach-check-unavailable' });

function renderInvite(hash: string | null = `#token=${TOKEN}`) {
  window.history.replaceState(null, '', `/admin/accept-invite${hash ?? ''}`);
  const router = createMemoryRouter(
    [
      { Component: AuthLayout, children: [{ path: '/admin/accept-invite', Component: AcceptInviteRoute }] },
      { path: '/admin/login', element: <p>The sign-in page</p> },
    ],
    { initialEntries: ['/admin/accept-invite'] },
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

describe('S6 token handling and the checking state', () => {
  it('removes the token from the address bar before the check request, and sends it in the body', async () => {
    const probe = answer();
    renderInvite();

    await formReady();

    expect(probe.hashAtCheck).toEqual(['']);
    expect(window.location.href).not.toContain(TOKEN);
    expect(probe.checkBodies).toEqual([{ token: TOKEN }]);
  });

  it('shows the invalid state at once, with no request, when there is no fragment', async () => {
    const probe = answer();
    renderInvite(null);

    const heading = await screen.findByRole('heading', { level: 1, name: 'This invite has expired' });
    expect(heading).toHaveFocus();
    expect(probe.checkBodies).toEqual([]);
    await expectNoAxeViolations(document.body);
  });

  it('says "Checking your link…" with a skeleton, then "Link checked." when the form shows', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    answer({
      check: async () => {
        await gate;
        return HttpResponse.json({ email: EMAIL, firstName: 'Ana' });
      },
    });
    renderInvite();

    expect(await screen.findByRole('heading', { level: 1, name: 'Set your password' })).toBeInTheDocument();
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

  it('names the account in the subline, adds a hidden username input and focuses New password on arrival', async () => {
    answer();
    const { view } = renderInvite();

    await formReady();

    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' &&
          node.textContent ===
            `Welcome to CSPS Admin. Choose a password for ${EMAIL} to finish setting up your account.`,
      ),
    ).toBeInTheDocument();
    const username = view.container.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue(EMAIL);
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(document.title).toBe('Set your password · CSPS Admin');
    await expectNoAxeViolations(document.body);
  });
});

describe('S6 invalid and failed invites', () => {
  it('shows one invalid state for a refused invite: focus on the heading, the body copy, only the back link', async () => {
    answer({
      check: () => problemResponse(404, { title: 'This invite has expired', status: 404, code: 'auth.invite-invalid' }),
    });
    renderInvite();

    const heading = await screen.findByRole('heading', { level: 1, name: 'This invite has expired' });
    expect(heading).toHaveFocus();
    expect(
      screen.getByText('Invite links work for 72 hours and only once. Ask a Manager to send you a new invite.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new link/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('does not call an invite expired when the check itself failed: it offers the check again', async () => {
    const user = userEvent.setup();
    let calls = 0;
    answer({
      check: () => {
        calls += 1;
        return calls === 1
          ? problemResponse(503, { title: 'Down', status: 503 })
          : HttpResponse.json({ email: EMAIL, firstName: 'Ana' });
      },
    });
    renderInvite();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This invite has expired' })).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await formReady();
    expect(calls).toBe(2);
  });

  it('turns to the invalid state when the invite stopped working between the check and the save', async () => {
    const user = userEvent.setup();
    answer({ accept: () => problemResponse(404, { title: 'This invite has expired', status: 404 }) });
    renderInvite();
    await formReady();

    await fillAndSave(user);

    const heading = await screen.findByRole('heading', { level: 1, name: 'This invite has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});

describe('S6 validation that mirrors the server (OR-3)', () => {
  it("keeps the invitee's first name out of the password before any request", async () => {
    const user = userEvent.setup();
    const probe = answer();
    renderInvite();
    await formReady();

    await fillAndSave(user, 'Ana#Mabuhay2026');

    expect(await screen.findByText("Don't use your name or email in your password.")).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(probe.acceptBodies).toEqual([]);
    await expectNoAxeViolations(document.body);
  });

  it('shows a rule-specific message and a mismatch message with no request', async () => {
    const user = userEvent.setup();
    const probe = answer();
    renderInvite();
    await formReady();

    await fillAndSave(user, 'Pass1234', 'Pass1234');
    expect(await screen.findByText('Add at least one symbol, like ! or #.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('New password'), GOOD);
    await user.type(screen.getByLabelText('Confirm new password'), 'Mabuhay#Tahi2027');
    await user.click(screen.getByRole('button', { name: 'Save Password' }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(probe.acceptBodies).toEqual([]);
  });
});

describe('S6 saving', () => {
  it('sends the token and password in the body with an Idempotency-Key and opens sign-in with the notice', async () => {
    const user = userEvent.setup();
    const probe = answer();
    const router = renderInvite();
    await formReady();

    await fillAndSave(user);

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(probe.acceptBodies).toEqual([{ token: TOKEN, newPassword: GOOD }]);
    expect(probe.acceptKeys[0]).toMatch(/\S/);
    expect(takeSignInNotice()).toBe('password-set');
  });

  it("shows the server's message under New password and moves focus there", async () => {
    const user = userEvent.setup();
    answer({
      accept: () =>
        problemResponse(400, {
          title: 'Check the highlighted fields.',
          status: 400,
          errors: { NewPassword: ['This password has appeared in a data breach. Choose a different one.'] },
        }),
    });
    renderInvite();
    await formReady();

    await fillAndSave(user, 'Pwned#Pass2026');

    expect(
      await screen.findByText('This password has appeared in a data breach. Choose a different one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();
    await expectNoAxeViolations(document.body);
  });

  it('fails closed when the breach check cannot be reached: banner, values kept, focus on Save Password, nothing saved', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const probe = answer({
      accept: () => {
        calls += 1;
        return calls === 1 ? breachDown() : new HttpResponse(null, { status: 204 });
      },
    });
    renderInvite();
    await formReady();

    await fillAndSave(user);

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText("We couldn't check your password right now.")).toBeInTheDocument();
    expect(within(banner).getByText('Wait a minute, then try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
    expect(screen.getByLabelText('Confirm new password')).toHaveValue(GOOD);
    expect(screen.getByRole('button', { name: 'Save Password' })).toHaveFocus();
    expect(screen.queryByText('The sign-in page')).not.toBeInTheDocument();
    expect(takeSignInNotice()).toBeNull();
    await expectNoAxeViolations(document.body);

    // The invite stays usable: the next try is a new submission with a fresh Idempotency-Key.
    await user.click(screen.getByRole('button', { name: 'Save Password' }));

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(probe.acceptKeys).toHaveLength(2);
    expect(probe.acceptKeys[0]).toMatch(/\S/);
    expect(probe.acceptKeys[1]).toMatch(/\S/);
    expect(probe.acceptKeys[1]).not.toBe(probe.acceptKeys[0]);
    expect(takeSignInNotice()).toBe('password-set');
  });

  it('shows the shared banner for a failure that is not the password, and keeps what was typed', async () => {
    const user = userEvent.setup();
    answer({ accept: () => problemResponse(429, { title: 'Slow down', status: 429 }) });
    renderInvite();
    await formReady();

    await fillAndSave(user);

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('Too many tries')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
  });
});
