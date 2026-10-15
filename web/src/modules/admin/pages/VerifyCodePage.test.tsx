import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { VerifyCodeRoute } from '@/modules/admin/pages/VerifyCodePage';
import {
  clearSession,
  getPasswordChangeReason,
  getPendingEmail,
  getSessionUser,
  setPendingEmail,
} from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// S2 Check your email, /admin/login/verify (D-01, AUTH-02, A11Y-03; plan 04-27).

interface VerifyProbe {
  bodies: unknown[];
}

/** Answers POST /api/v1/auth/two-factor/verify with the given body and records what was sent. */
function answerVerify(body: unknown = { next: 'signed-in', reason: null, session: sessionResponse() }): VerifyProbe {
  const probe: VerifyProbe = { bodies: [] };
  server.use(
    http.post('*/api/v1/auth/two-factor/verify', async ({ request }) => {
      probe.bodies.push(await request.json());
      return HttpResponse.json(body);
    }),
  );
  return probe;
}

function renderVerify(entry = '/admin/login/verify') {
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/login/verify', Component: VerifyCodeRoute }],
      },
      { path: '/admin', element: <p>The admin home</p> },
      { path: '/admin/orders', element: <p>The orders page</p> },
      { path: '/admin/login', element: <p>The sign-in page</p> },
      { path: '/admin/login/new-password', element: <p>The new password step</p> },
    ],
    { initialEntries: [entry] },
  );
  const view = render(<RouterProvider router={router} />);
  return Object.assign(router, { view });
}

beforeEach(() => {
  clearSession();
  setPendingEmail('paolo.garcia@gmail.com');
});

describe('S2 code step tracer', () => {
  it('shows the sign-in card look on its own route, naming the typed email', async () => {
    renderVerify();

    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('paolo.garcia@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/We emailed a 6-digit code to/)).toHaveTextContent(
      'We emailed a 6-digit code to paolo.garcia@gmail.com. It works for 15 minutes.',
    );
    expect(screen.getByText('Sign-in code')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByRole('button', { name: 'Verify Code' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: 'Resend Code' })).toBeInTheDocument();
    expect(screen.getByText('Never share this code. CSPS staff will never ask you for it.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Use a different account' })).toHaveAttribute('href', '/admin/login');
  });

  it('puts the cursor in the first box when the screen opens', async () => {
    renderVerify();

    await screen.findByRole('heading', { level: 1, name: 'Check your email' });
    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
    });
  });

  it('uses "your email" when nothing is in memory (after a refresh) and still works', async () => {
    clearSession();
    renderVerify();

    expect(await screen.findByText('We emailed a 6-digit code to your email. It works for 15 minutes.')).toBeVisible();
  });

  it('sends the typed code only when Verify Code is pressed, then opens the admin and stores the session', async () => {
    const user = userEvent.setup();
    const probe = answerVerify();
    const router = renderVerify();

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.keyboard('048213');
    // Six digits typed: nothing is sent (no auto-submit, WCAG 3.2.2).
    expect(probe.bodies).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('The admin home')).toBeInTheDocument();
    expect(probe.bodies).toEqual([{ code: '048213' }]);
    expect(router.state.location.pathname).toBe('/admin');
    expect(getSessionUser()?.name).toBe('Carmen Reyes');
    expect(getPendingEmail()).toBeNull();
  });

  it('goes to the validated return path after a signed-in answer', async () => {
    const user = userEvent.setup();
    answerVerify();
    renderVerify('/admin/login/verify?returnUrl=%2Fadmin%2Forders');

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.keyboard('048213');
    await user.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('The orders page')).toBeInTheDocument();
  });

  it('ignores a return path that is not a safe admin path', async () => {
    const user = userEvent.setup();
    answerVerify();
    const router = renderVerify('/admin/login/verify?returnUrl=https%3A%2F%2Fevil.example%2Fadmin');

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.keyboard('048213');
    await user.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('The admin home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('goes to the new password step for a must-change account, keeping the reason in memory and no session', async () => {
    const user = userEvent.setup();
    answerVerify({ next: 'set-new-password', reason: 'temporary', session: null });
    renderVerify();

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.keyboard('048213');
    await user.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('The new password step')).toBeInTheDocument();
    expect(getPasswordChangeReason()).toBe('temporary');
    expect(getSessionUser()).toBeNull();
  });

  it('shows "Enter all 6 digits." under the code and focuses box 1 without a request when it is empty', async () => {
    const user = userEvent.setup();
    const probe = answerVerify();
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('Enter all 6 digits.')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
    expect(probe.bodies).toEqual([]);
  });
});
