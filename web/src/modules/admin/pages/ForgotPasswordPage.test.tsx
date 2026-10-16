import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import AuthLayout from '@/layouts/AuthLayout';
import { ForgotPasswordRoute } from '@/modules/admin/pages/ForgotPasswordPage';
import { passwordService } from '@/modules/admin/services/passwordService';
import { clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// S4 Reset your password, /admin/forgot-password (AUTH-08, D-16, D-40; plan 04-28).

interface ForgotProbe {
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers POST /api/v1/auth/password/forgot with 202 and records the bodies and Idempotency-Keys. */
function answerForgot(): ForgotProbe {
  const probe: ForgotProbe = { bodies: [], keys: [] };
  server.use(
    http.post('*/api/v1/auth/password/forgot', async ({ request }) => {
      probe.bodies.push(await request.json());
      probe.keys.push(request.headers.get('Idempotency-Key'));
      return new HttpResponse(null, { status: 202 });
    }),
  );
  return probe;
}

function renderForgot() {
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/forgot-password', Component: ForgotPasswordRoute }],
      },
      { path: '/admin/login', element: <p>The sign-in page</p> },
    ],
    { initialEntries: ['/admin/forgot-password'] },
  );
  return Object.assign(router, { view: render(<RouterProvider router={router} />) });
}

async function sendFor(user: ReturnType<typeof userEvent.setup>, email: string): Promise<void> {
  await user.type(await screen.findByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S4 request state', () => {
  it('shows the reset screen with the email field and the back link', async () => {
    renderForgot();

    expect(await screen.findByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();
    expect(
      screen.getByText("Enter the email you sign in with. We'll send you a link to set a new password."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    await expectNoAxeViolations(document.body);
  });

  it.each([
    ['', 'Enter your email.'],
    ['paolo', 'Enter a valid email, like name@gmail.com'],
  ])('shows %j as a field error with the cursor in the field and sends nothing', async (typed, message) => {
    const user = userEvent.setup();
    const probe = answerForgot();
    renderForgot();

    const field = await screen.findByLabelText('Email');
    if (typed !== '') {
      await user.type(field, typed);
    }
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(probe.bodies).toEqual([]);
  });
});

describe('S4 sent state', () => {
  it('swaps to the sent card with the typed email in bold and focus on its heading', async () => {
    const user = userEvent.setup();
    const probe = answerForgot();
    renderForgot();

    await sendFor(user, ' paolo.garcia@gmail.com ');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Check your email' });
    expect(heading).toHaveFocus();
    expect(screen.getByText('paolo.garcia@gmail.com').tagName).toBe('STRONG');
    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' &&
          node.textContent ===
            'If an account exists for paolo.garcia@gmail.com, we sent a link to reset your password. It works for 30 minutes.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Didn't get it? Check your spam folder. The email can take a few minutes."),
    ).toBeInTheDocument();
    expect(probe.bodies).toEqual([{ email: 'paolo.garcia@gmail.com' }]);
    expect(probe.keys[0]).toMatch(/\S/);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(document.title).toBe('Check your email · CSPS Admin');
    await expectNoAxeViolations(document.body);
  });

  it('looks the same for an address that has no account (the server answers 202 for any)', async () => {
    const user = userEvent.setup();
    answerForgot();
    renderForgot();

    await sendFor(user, 'nobody.at.all@example.test');

    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for/)).toBeInTheDocument();
  });

  it('"Use a Different Email" returns to an empty form with the cursor in the field and sends a new key next time', async () => {
    const user = userEvent.setup();
    const probe = answerForgot();
    renderForgot();
    await sendFor(user, 'paolo.garcia@gmail.com');
    await screen.findByRole('heading', { level: 1, name: 'Check your email' });

    await user.click(screen.getByRole('button', { name: 'Use a Different Email' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveFocus();

    // The same address again is a new submission: it is sent, with a new key.
    await user.type(screen.getByLabelText('Email'), 'paolo.garcia@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await screen.findByRole('heading', { level: 1, name: 'Check your email' });
    expect(probe.bodies).toHaveLength(2);
    expect(probe.keys[1]).not.toBe(probe.keys[0]);
  });
});

describe('S4 failures', () => {
  it('shows the shared banner for a network failure and the retry reuses the same Idempotency-Key', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    vi.spyOn(passwordService, 'forgot')
      .mockImplementationOnce((_body, { idempotencyKey }) => {
        keys.push(idempotencyKey);
        return Promise.reject(new HttpError({ kind: 'network' }));
      })
      .mockImplementationOnce((_body, { idempotencyKey }) => {
        keys.push(idempotencyKey);
        return Promise.resolve();
      });
    renderForgot();

    await sendFor(user, 'paolo.garcia@gmail.com');
    expect(await screen.findByText("Couldn't reach the server")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email' })).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows the shared 429 copy', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/password/forgot', () =>
        HttpResponse.json(
          { title: 'Too many requests', status: 429 },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    renderForgot();

    await sendFor(user, 'paolo.garcia@gmail.com');

    expect(await screen.findByText('Too many tries')).toBeInTheDocument();
    expect(screen.getByText('Wait a minute, then try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('puts a server message about the email under the field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/password/forgot', () =>
        HttpResponse.json(
          { title: 'Invalid', status: 400, errors: { Email: ['Enter a valid email, like name@gmail.com'] } },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    renderForgot();

    // Shaped well enough for the browser check, so the server's own message is what shows.
    await sendFor(user, 'a@b');

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });
});
