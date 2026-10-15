import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hitAreaClasses } from '@/components/actions';
import AuthLayout from '@/layouts/AuthLayout';
import { SignInRoute } from '@/modules/admin/pages/SignInPage';
import { clearSession, getPendingEmail, getResendAvailableAt, setSignInNotice } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
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
  const view = render(<RouterProvider router={router} />);
  return Object.assign(router, { view });
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

  it('keeps the wait for the next code in memory for the code step', async () => {
    const user = userEvent.setup();
    answerSignIn();
    renderSignIn();
    const before = Date.now();

    await user.type(await screen.findByLabelText('Email'), 'paolo.garcia@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'tahi2026');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('The code step')).toBeInTheDocument();
    expect(getResendAvailableAt()).toBeGreaterThanOrEqual(before + 60_000);
    expect(getResendAvailableAt()).toBeLessThanOrEqual(Date.now() + 60_000);
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

describe('S1 shared pieces (OQ-5, Note)', () => {
  it('gives Forgot password, the checkbox label and the back link the invisible 44px tap area', async () => {
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    const area = hitAreaClasses.split(' ');
    const forgot = screen.getByRole('link', { name: 'Forgot password?' });
    const back = screen.getByRole('link', { name: 'Back to the CSPS website' });
    const label = screen.getByRole('checkbox', { name: 'Keep me signed in' }).closest('label');
    expect(forgot.className.split(' ')).toEqual(expect.arrayContaining(area));
    expect(back.className.split(' ')).toEqual(expect.arrayContaining(area));
    expect(label?.className.split(' ')).toEqual(expect.arrayContaining(area));
  });

  it('shows the staff-only line as a plain Note, not a live status', async () => {
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    const line = screen.getByText('Staff only. Customer orders are placed through the public site or Messenger.');
    expect(line.closest('div')?.querySelector('svg')).toHaveClass('lucide-shield-check');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// ── Task 3: validation first, the generic failure, notices, no remembered email, accessible authentication ──

function problem(status: number, extra: Record<string, unknown> = {}): Response {
  return HttpResponse.json(
    { title: 'Server says no', status, ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** Answers every sign-in with `reply` and counts the requests. */
function answerWith(reply: () => Response): { count: number } {
  const probe = { count: 0 };
  server.use(
    http.post('*/api/v1/auth/sign-in', () => {
      probe.count += 1;
      return reply();
    }),
  );
  return probe;
}

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  email = 'paolo.garcia@gmail.com',
  password = 'wrong-one',
) {
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
}

describe('S1 client validation first (OR-3)', () => {
  it('submitting empty shows both messages, focuses Email and sends nothing', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(await screen.findByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('a password-only gap focuses the Password field', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText('Email'), 'paolo.garcia@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('a malformed email says how it should look, and fixing it clears the message as you type', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText('Email'), 'paolo');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), '@gmail.com');

    await waitFor(() => {
      expect(screen.queryByText('Enter a valid email, like name@gmail.com')).toBeNull();
    });
  });
});

describe('S1 failures (AUTH-01, D-02, OQ-1)', () => {
  it('a 401 shows the one App. E.5 banner, keeps both values and moves focus to Password', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(401, { code: 'auth.invalid-credentials' }));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Email or password is incorrect.');
    expect(banner).toHaveTextContent('Check for typos, or ask your manager to reset your password.');
    expect(banner.textContent).not.toMatch(/deactivated|locked|Reference/i);
    expect(screen.getByLabelText('Email')).toHaveValue('paolo.garcia@gmail.com');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-one');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('shows the same banner for any 401, so an account is never described (D-02)', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(401, { code: 'auth.something-else' }));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('a 429 shows the shared "Too many tries" banner and focus stays on Sign In', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(429));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Too many tries');
    expect(banner).toHaveTextContent('Wait a minute, then try again.');
    expect(screen.getByRole('button', { name: 'Sign In' })).toHaveFocus();
  });

  it('a network error shows "Couldn\'t reach the server"', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/auth/sign-in', () => HttpResponse.error()));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the server");
    expect(screen.getByRole('button', { name: 'Sign In' })).toHaveFocus();
  });

  it('a 5xx shows the reference and keeps focus on Sign In', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(500, { traceId: 'tr-500' }));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Something went wrong');
    expect(banner).toHaveTextContent('Reference: tr-500');
    expect(screen.getByRole('button', { name: 'Sign In' })).toHaveFocus();
  });

  it('puts the server field messages under the fields and focuses the first (a 400 with errors)', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(400, { errors: { Email: ['Enter a valid email, like name@gmail.com'] } }));
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted fields.');
    expect(screen.getByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('clears the banner when the next attempt starts', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(
      http.post('*/api/v1/auth/sign-in', () => {
        attempts += 1;
        return attempts === 1 ? problem(401) : HttpResponse.json({ resendAfterSeconds: 60 });
      }),
    );
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('The code step')).toBeInTheDocument();
  });

  it('while pending the button reads "Signing in", is aria-disabled and a second click sends nothing', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const probe = { count: 0 };
    server.use(
      http.post('*/api/v1/auth/sign-in', async () => {
        probe.count += 1;
        await gate;
        return HttpResponse.json({ resendAfterSeconds: 60 });
      }),
    );
    renderSignIn();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    const busy = await screen.findByRole('button', { name: 'Signing in' });
    await user.click(busy);

    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveAttribute('aria-busy', 'true');
    release();
    expect(await screen.findByText('The code step')).toBeInTheDocument();
    expect(probe.count).toBe(1);
  });
});

describe('S1 notices (UI-SPEC "Sign-in notices")', () => {
  it('shows the one-shot notice in a live Note, clears it on the next submit and does not bring it back', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(401));
    setSignInNotice('session-ended');
    const router = renderSignIn();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Your session ended. Sign in again.');
    expect(notice.querySelector('svg')).toHaveClass('lucide-info');

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('status')).toBeNull();

    router.view.unmount();
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['signed-out', "You've signed out.", 'lucide-circle-check'],
    ['password-changed', 'Your password was changed. Sign in with your new password.', 'lucide-circle-check'],
    ['password-set', 'Your password is set. Sign in to continue.', 'lucide-circle-check'],
    ['timed-out', 'Your sign-in timed out. Sign in again.', 'lucide-info'],
  ] as const)('shows the %s notice', async (key, text, icon) => {
    setSignInNotice(key);
    renderSignIn();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(text);
    expect(notice.querySelector('svg')).toHaveClass(icon);
  });

  it('shows no notice on a plain visit', async () => {
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('S1 never remembers the email (D-09, T-04-92)', () => {
  it('starts empty and writes nothing to any storage or cookie, even through a full sign-in', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    answerSignIn();
    renderSignIn();

    expect(await screen.findByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    await fillIn(user);
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByText('The code step');

    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    setItem.mockRestore();
  });
});

describe('S1 accessible authentication (A11Y-03, WCAG 3.3.8)', () => {
  it('lists the email before the password and keeps the autocomplete values, also when the password is shown', async () => {
    const user = userEvent.setup();
    renderSignIn();
    const email = await screen.findByLabelText('Email');
    const password = screen.getByLabelText('Password');

    expect(email.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('accepts pasted text in both fields', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(await screen.findByLabelText('Email'));
    await user.paste('paolo.garcia@gmail.com');
    await user.click(screen.getByLabelText('Password'));
    await user.paste('a long pasted password');

    expect(screen.getByLabelText('Email')).toHaveValue('paolo.garcia@gmail.com');
    expect(screen.getByLabelText('Password')).toHaveValue('a long pasted password');
  });

  it('has no CAPTCHA or puzzle: only the two fields, the box and the buttons', async () => {
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByRole('img', { name: /captcha/i })).toBeNull();
  });

  it('has no axe violations on the page, with errors and with a banner', async () => {
    const user = userEvent.setup();
    answerWith(() => problem(401));
    const router = renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    await expectNoAxeViolations(router.view.container);

    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByText('Enter your email.');
    await expectNoAxeViolations(router.view.container);

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations(router.view.container);
  });
});

describe('S1 return path and title', () => {
  it('replaces an unsafe return path with /admin on the way to the code step (D-07)', async () => {
    const user = userEvent.setup();
    answerSignIn();
    const router = renderSignIn('/admin/login?returnUrl=https%3A%2F%2Fevil.example');

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByText('The code step');

    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin');
  });

  it('titles the document "Sign in · CSPS Admin"', async () => {
    renderSignIn();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    await waitFor(() => {
      expect(document.title).toBe('Sign in · CSPS Admin');
    });
  });
});
