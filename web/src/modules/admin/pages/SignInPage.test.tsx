import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { SignInRoute } from '@/modules/admin/pages/SignInPage';
import { clearSession, getPendingEmail } from '@/modules/admin/services/session';
import { server } from '@/test/msw';

// S1 Sign in (App. E.5 with the owner's deviations, plan 04-26; AUTH-01, AUTH-05, D-03).

interface SignInProbe {
  bodies: unknown[];
}

/** Answers POST /api/v1/auth/sign-in with the code step's 200 and records the bodies. */
function answerSignIn(): SignInProbe {
  const probe: SignInProbe = { bodies: [] };
  server.use(
    http.post('*/api/v1/auth/sign-in', async ({ request }) => {
      probe.bodies.push(await request.json());
      return HttpResponse.json({ resendAfterSeconds: 60 });
    }),
  );
  return probe;
}

function renderSignIn(entry = '/admin/login') {
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/login', Component: SignInRoute }],
      },
      { path: '/admin/login/verify', element: <p>The code step</p> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  clearSession();
});

describe('S1 sign in tracer', () => {
  it('shows the App. E.5 screen with the unticked box and the forgot-password link', async () => {
    renderSignIn();

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('CSPS Admin')).toBeInTheDocument();
    expect(screen.getByText('Use the email and password your manager set up for you.')).toBeInTheDocument();
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(email).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/admin/forgot-password');
    expect(screen.getByRole('button', { name: 'Sign In' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Back to the CSPS website' })).toHaveAttribute('href', '/');
    expect(
      screen.getByText('Staff only. Customer orders are placed through the public site or Messenger.'),
    ).toBeVisible();
  });

  it('sends the sign-in with the Keep me signed in choice and opens the code step with the same return path', async () => {
    const user = userEvent.setup();
    const probe = answerSignIn();
    const router = renderSignIn('/admin/login?returnUrl=%2Fadmin%2Forders');

    await user.type(await screen.findByLabelText('Email'), 'paolo.garcia@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'tahi2026');
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('The code step')).toBeInTheDocument();
    expect(probe.bodies).toEqual([{ email: 'paolo.garcia@gmail.com', password: 'tahi2026', keepSignedIn: true }]);
    expect(router.state.location.pathname).toBe('/admin/login/verify');
    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin%2Forders');
    expect(getPendingEmail()).toBe('paolo.garcia@gmail.com');
  });

  it('sends keepSignedIn false when the box is left alone', async () => {
    const user = userEvent.setup();
    const probe = answerSignIn();
    renderSignIn();

    await user.type(await screen.findByLabelText('Email'), 'paolo.garcia@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'tahi2026');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('The code step')).toBeInTheDocument();
    expect(probe.bodies).toEqual([{ email: 'paolo.garcia@gmail.com', password: 'tahi2026', keepSignedIn: false }]);
  });
});
