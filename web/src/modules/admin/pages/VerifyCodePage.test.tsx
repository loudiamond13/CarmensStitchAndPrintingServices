import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { VerifyCodeRoute } from '@/modules/admin/pages/VerifyCodePage';
import {
  clearSession,
  getPendingEmail,
  getResendAvailableAt,
  getSessionUser,
  setPendingEmail,
  setResendAvailableAt,
  takeSignInNotice,
} from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// S2 Check your email, /admin/login/verify (D-01, AUTH-02, A11Y-03; plan 04-27).

interface VerifyProbe {
  bodies: unknown[];
}

/** Answers POST /api/v1/auth/two-factor/verify with the given body and records what was sent. */
function answerVerify(
  body: JsonBodyType = { next: 'signed-in', reason: null, session: sessionResponse() },
): VerifyProbe {
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
  takeSignInNotice();
  setPendingEmail('paolo.garcia@gmail.com');
});

afterEach(() => {
  vi.useRealTimers();
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

// ── Task 2: code errors, the resend countdown and its announcements, the caps and the timed-out return ──

function problem(status: number, extra: Record<string, unknown> = {}): Response {
  return HttpResponse.json(
    { title: 'Server says no', status, ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** A code error as the server sends it: a 400 on the code field, with its code and plain words. */
function codeError(code: string, message: string): Response {
  return problem(400, { code, errors: { code: [message] } });
}

function answerVerifyWith(reply: () => Response): { count: number } {
  const probe = { count: 0 };
  server.use(
    http.post('*/api/v1/auth/two-factor/verify', () => {
      probe.count += 1;
      return reply();
    }),
  );
  return probe;
}

function answerResendWith(reply: () => Response): { count: number } {
  const probe = { count: 0 };
  server.use(
    http.post('*/api/v1/auth/two-factor/resend', () => {
      probe.count += 1;
      return reply();
    }),
  );
  return probe;
}

type User = ReturnType<typeof userEvent.setup>;

async function typeAndVerify(user: User, code = '048213'): Promise<void> {
  await user.click(await screen.findByLabelText('Digit 1 of 6'));
  await user.keyboard(code);
  await user.click(screen.getByRole('button', { name: 'Verify Code' }));
}

function boxValues(): string[] {
  return [1, 2, 3, 4, 5, 6].map(
    (index) => screen.getByRole<HTMLInputElement>('textbox', { name: `Digit ${String(index)} of 6` }).value,
  );
}

const WRONG = "That code isn't right. Check the newest email and try again.";

describe('S2 client validation first (OR-3, A11Y-03)', () => {
  it('five digits and Verify: "Enter all 6 digits." under the code, focus on box 1, no request', async () => {
    const user = userEvent.setup();
    const probe = answerVerifyWith(() => problem(500));
    renderVerify();

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.keyboard('04821');
    await user.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('Enter all 6 digits.')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
    expect(screen.getByLabelText('Digit 3 of 6')).toHaveAttribute('aria-invalid', 'true');
    expect(probe.count).toBe(0);
  });

  it('pasting a six-digit code into box 3 fills all six boxes and sends nothing until Verify', async () => {
    const user = userEvent.setup();
    const probe = answerVerifyWith(() => problem(500));
    renderVerify();

    await user.click(await screen.findByLabelText('Digit 3 of 6'));
    await user.paste('048213');

    expect(boxValues()).toEqual(['0', '4', '8', '2', '1', '3']);
    expect(probe.count).toBe(0);
  });

  it('clears the message as the code is fixed', async () => {
    const user = userEvent.setup();
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Verify Code' }));
    expect(await screen.findByText('Enter all 6 digits.')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.keyboard('048213');

    await waitFor(() => {
      expect(screen.queryByText('Enter all 6 digits.')).not.toBeInTheDocument();
    });
  });
});

describe('S2 code errors (AUTH-03, D-01)', () => {
  it.each([
    ['auth.code-wrong', WRONG],
    ['auth.code-used-up', "This code can't be used anymore. Use Resend Code to get a new one."],
    ['auth.code-expired', 'This code has expired. Use Resend Code to get a new one.'],
  ])('%s shows the server words under the code, clears all six boxes and focuses box 1', async (code, message) => {
    const user = userEvent.setup();
    answerVerifyWith(() => codeError(code, message));
    renderVerify();

    await typeAndVerify(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(boxValues()).toEqual(['', '', '', '', '', '']);
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
    expect(screen.getByLabelText('Digit 4 of 6')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps Resend usable after a dead or expired code', async () => {
    const user = userEvent.setup();
    answerVerifyWith(() => codeError('auth.code-expired', 'This code has expired. Use Resend Code to get a new one.'));
    renderVerify();

    await typeAndVerify(user);
    await screen.findByText('This code has expired. Use Resend Code to get a new one.');

    expect(screen.getByRole('button', { name: 'Resend Code' })).not.toHaveAttribute('aria-disabled');
  });

  it('falls back to the screen words when a code error carries no field message', async () => {
    const user = userEvent.setup();
    answerVerifyWith(() => problem(400, { code: 'auth.code-wrong' }));
    renderVerify();

    await typeAndVerify(user);

    expect(await screen.findByText(WRONG)).toBeInTheDocument();
  });

  it('a new attempt after an error sends the new code and goes on', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    answerVerifyWith(() => {
      attempts += 1;
      return attempts === 1
        ? codeError('auth.code-wrong', WRONG)
        : HttpResponse.json({ next: 'signed-in', reason: null, session: sessionResponse() });
    });
    renderVerify();

    await typeAndVerify(user, '111111');
    await screen.findByText(WRONG);
    await typeAndVerify(user, '048213');

    expect(await screen.findByText('The admin home')).toBeInTheDocument();
  });

  it('the cross-ticket lock shows the banner with the safety words', async () => {
    const user = userEvent.setup();
    answerVerifyWith(() => problem(429, { code: 'auth.code-lockout' }));
    renderVerify();

    await typeAndVerify(user);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Too many wrong codes.');
    expect(banner).toHaveTextContent('For your safety, sign-in is paused for 15 minutes. We emailed you about it.');
  });

  it('a gone ticket (401) leaves the "timed out" notice and returns to sign-in', async () => {
    const user = userEvent.setup();
    answerVerifyWith(() => problem(401, { code: 'auth.ticket-expired' }));
    const router = renderVerify();

    await typeAndVerify(user);

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/login');
    expect(takeSignInNotice()).toBe('timed-out');
  });

  it('a server error and a network failure show the shared banner', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    answerVerifyWith(() => {
      attempts += 1;
      return attempts === 1 ? problem(500, { traceId: 'tr-500' }) : HttpResponse.error();
    });
    renderVerify();

    await typeAndVerify(user);
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent('Something went wrong');
    expect(first).toHaveTextContent('Reference: tr-500');

    await typeAndVerify(user, '123456');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the server");
    });
  });

  it('a signed-in answer with no session is treated as a server fault', async () => {
    const user = userEvent.setup();
    answerVerify({ next: 'signed-in', reason: null, session: null });
    renderVerify();

    await typeAndVerify(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(getSessionUser()).toBeNull();
  });

  it('while the code is being checked the button reads "Verifying" and a second click sends nothing', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const probe = { count: 0 };
    server.use(
      http.post('*/api/v1/auth/two-factor/verify', async () => {
        probe.count += 1;
        await gate;
        return HttpResponse.json({ next: 'signed-in', reason: null, session: sessionResponse() });
      }),
    );
    renderVerify();

    await typeAndVerify(user);
    const button = await screen.findByRole('button', { name: 'Verifying' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    release();

    expect(await screen.findByText('The admin home')).toBeInTheDocument();
    expect(probe.count).toBe(1);
  });
});

/** Records each distinct non-empty text the polite status shows. */
function watchStatus(): string[] {
  const form = screen.getByRole('form', { name: 'Check your email' });
  const region = within(form).getByRole('status');
  const seen: string[] = [];
  const record = (): void => {
    const text = region.textContent;
    if (text !== '' && seen.at(-1) !== text) {
      seen.push(text);
    }
  };
  record();
  new MutationObserver(record).observe(region, { childList: true, characterData: true, subtree: true });
  return seen;
}

const STARTED = 'We sent a new code. You can ask for another in 60 seconds.';
const READY = 'You can ask for a new code now.';

describe('S2 resend countdown (AUTH-04, OQ-6, D-10)', () => {
  it('counts down m:ss from the 60 seconds the server gave, aria-disabled, and ends on "Resend Code"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setResendAvailableAt(Date.now() + 60_000);
    renderVerify();

    const resend = await screen.findByRole('button', { name: 'Resend code in 1:00' });
    expect(resend).toHaveAttribute('aria-disabled', 'true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(18_000);
    });
    expect(screen.getByRole('button', { name: 'Resend code in 0:42' })).toHaveAttribute('aria-disabled', 'true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(42_000);
    });
    expect(screen.getByRole('button', { name: 'Resend Code' })).not.toHaveAttribute('aria-disabled');
  });

  it('does nothing when Resend is pressed during the countdown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    setResendAvailableAt(Date.now() + 60_000);
    const probe = answerResendWith(() => HttpResponse.json({ resendAfterSeconds: 60 }));
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Resend code in 1:00' }));

    expect(probe.count).toBe(0);
  });

  it('speaks once when the cooldown starts and once when it ends, not on every tick', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setResendAvailableAt(Date.now() + 60_000);
    renderVerify();
    await screen.findByRole('button', { name: 'Resend code in 1:00' });
    const seen = watchStatus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(seen).toEqual([STARTED]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(seen).toEqual([STARTED, READY]);
    const region = within(screen.getByRole('form', { name: 'Check your email' })).getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Resend Code' }).closest('[aria-live]')).toBeNull();
  });

  it('a resend asks the server, shows "We sent you a new code." and starts the countdown again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    setResendAvailableAt(Date.now() + 5_000);
    const probe = answerResendWith(() => HttpResponse.json({ resendAfterSeconds: 60 }));
    renderVerify();
    await screen.findByRole('button', { name: 'Resend code in 0:05' });
    const seen = watchStatus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    await user.click(screen.getByRole('button', { name: 'Resend Code' }));

    expect(await screen.findByText('We sent you a new code.')).toBeVisible();
    expect(probe.count).toBe(1);
    expect(screen.getByRole('button', { name: 'Resend code in 1:00' })).toHaveAttribute('aria-disabled', 'true');
    expect(getResendAvailableAt()).toBeGreaterThan(Date.now());
    expect(seen).toEqual([STARTED, READY, STARTED]);
  });

  it('starts with Resend available after a page refresh, when no cooldown is known', async () => {
    renderVerify();

    const resend = await screen.findByRole('button', { name: 'Resend Code' });
    expect(resend).not.toHaveAttribute('aria-disabled');
  });

  it('the hourly cap shows the D-10 banner, keeps Resend aria-disabled and names no time', async () => {
    const user = userEvent.setup();
    answerResendWith(() => problem(429, { code: 'auth.resend-cap' }));
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Resend Code' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent("You've asked for too many codes.");
    expect(banner).toHaveTextContent('Try again in a little while.');
    expect(screen.getByRole('button', { name: 'Resend Code' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(/Resend code in/)).not.toBeInTheDocument();
  });

  it('a resend refused inside the cooldown shows the shared 429 copy', async () => {
    const user = userEvent.setup();
    answerResendWith(() => problem(429, { code: 'auth.resend-cooldown' }));
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Resend Code' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Too many tries');
    expect(banner).toHaveTextContent('Wait a minute, then try again.');
    expect(screen.getByRole('button', { name: 'Resend Code' })).not.toHaveAttribute('aria-disabled');
  });

  it('a gone ticket on resend also returns to sign-in with the "timed out" notice', async () => {
    const user = userEvent.setup();
    answerResendWith(() => problem(401, { code: 'auth.ticket-expired' }));
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Resend Code' }));

    expect(await screen.findByText('The sign-in page')).toBeInTheDocument();
    expect(takeSignInNotice()).toBe('timed-out');
  });

  it('clears the "new code" note when the next code is verified', async () => {
    const user = userEvent.setup();
    answerResendWith(() => HttpResponse.json({ resendAfterSeconds: 60 }));
    answerVerifyWith(() => problem(500));
    renderVerify();

    await user.click(await screen.findByRole('button', { name: 'Resend Code' }));
    await screen.findByText('We sent you a new code.');
    await typeAndVerify(user);

    await waitFor(() => {
      expect(screen.queryByText('We sent you a new code.')).not.toBeInTheDocument();
    });
  });
});

describe('S2 accessible authentication (A11Y-03, WCAG 3.2.2, 3.3.8)', () => {
  it('has no axe violations clean, with a code error and with a banner', async () => {
    const user = userEvent.setup();
    answerVerifyWith(() => codeError('auth.code-wrong', WRONG));
    answerResendWith(() => problem(429, { code: 'auth.resend-cap' }));
    const { view } = renderVerify();
    await screen.findByRole('heading', { level: 1, name: 'Check your email' });
    await expectNoAxeViolations(view.container);

    await typeAndVerify(user);
    await screen.findByText(WRONG);
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Resend Code' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations(view.container);
  });

  it('keeps the code out of the URL and out of every browser store', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    answerVerify();
    const router = renderVerify();

    await typeAndVerify(user);
    await screen.findByText('The admin home');

    expect(router.state.location.search).not.toContain('048213');
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    setItem.mockRestore();
  });
});
