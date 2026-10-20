import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import AuthLayout from '@/layouts/AuthLayout';
import { ConfirmEmailRoute } from '@/modules/admin/pages/ConfirmEmailPage';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// P3 Confirm your email, /admin/confirm-email#token=... (PROF-02, C-17 SPEC-GAP, T-05-43 to T-05-46; plan 05-16).

const TOKEN = 'x'.repeat(43);
const NEW_EMAIL = 'carmen.new@example.ph';
const problem = { 'Content-Type': 'application/problem+json' };

interface Probe {
  /** The address hash the page had when each check request arrived. */
  hashAtCheck: string[];
  checkBodies: unknown[];
  confirmBodies: unknown[];
  confirmKeys: (string | null)[];
}

/** Answers the link check (default: usable, for NEW_EMAIL) and the confirm (default: 200) and records what arrived. */
function answer(
  options: { check?: () => Response | Promise<Response>; confirm?: () => Response | Promise<Response> } = {},
): Probe {
  const probe: Probe = { hashAtCheck: [], checkBodies: [], confirmBodies: [], confirmKeys: [] };
  server.use(
    http.post('*/api/v1/profile/email-change/check', async ({ request }) => {
      probe.hashAtCheck.push(window.location.hash);
      probe.checkBodies.push(await request.json());
      return options.check ? options.check() : HttpResponse.json({ newEmail: NEW_EMAIL });
    }),
    http.post('*/api/v1/profile/email-change/confirm', async ({ request }) => {
      probe.confirmBodies.push(await request.json());
      probe.confirmKeys.push(request.headers.get('Idempotency-Key'));
      return options.confirm ? options.confirm() : HttpResponse.json({ newEmail: NEW_EMAIL });
    }),
  );
  return probe;
}

function problemResponse(status: number, body: JsonBodyType = { title: 'No', status }): Response {
  return HttpResponse.json(body, { status, headers: problem });
}

const invalidLink = () =>
  problemResponse(404, { title: 'This link has expired', status: 404, code: 'email-change.invalid' });
const takenLink = () =>
  problemResponse(409, { title: "This email can't be used.", status: 409, code: 'email-change.taken' });

function renderConfirm(hash: string | null = `#token=${TOKEN}`) {
  window.history.replaceState(null, '', `/admin/confirm-email${hash ?? ''}`);
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/confirm-email', Component: ConfirmEmailRoute }],
      },
      { path: '/admin/login', element: <p>The sign-in page</p> },
      { path: '/admin', element: <p>The admin home</p> },
    ],
    { initialEntries: ['/admin/confirm-email'] },
  );
  return Object.assign(router, { view: render(<RouterProvider router={router} />) });
}

async function ready(): Promise<void> {
  await screen.findByRole('button', { name: 'Confirm New Email' });
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('P3 token handling and the checking state', () => {
  it('removes the token from the address bar before the check request, and sends it in the body', async () => {
    const probe = answer();
    renderConfirm();

    await ready();

    expect(probe.hashAtCheck).toEqual(['']);
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);
    expect(probe.checkBodies).toEqual([{ token: TOKEN }]);
  });

  it('says "Checking your link…" with a skeleton, then "Link checked." when the question shows', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    answer({
      check: async () => {
        await gate;
        return HttpResponse.json({ newEmail: NEW_EMAIL });
      },
    });
    renderConfirm();

    expect(await screen.findByRole('heading', { level: 1, name: 'Confirm your email' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your link…');
    expect(screen.queryByRole('button', { name: 'Confirm New Email' })).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await act(async () => {
      release();
      await gate;
    });
    await ready();
    expect(screen.getByRole('status')).toHaveTextContent('Link checked.');
  });

  it('shows the invalid state at once, with no request, when there is no fragment', async () => {
    const probe = answer();
    renderConfirm(null);

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(probe.checkBodies).toEqual([]);
    expect(probe.confirmBodies).toEqual([]);
  });

  it('shows the invalid state at once when the fragment holds no token', async () => {
    const probe = answer();
    renderConfirm('#token=');

    expect(await screen.findByRole('heading', { level: 1, name: 'This link has expired' })).toBeInTheDocument();
    expect(probe.checkBodies).toEqual([]);
  });
});

describe('P3 ready', () => {
  it('names the new address in bold, offers the button and posts nothing to confirm until it is pressed', async () => {
    const probe = answer();
    renderConfirm();

    await ready();

    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' && node.textContent === `Change your CSPS sign-in email to ${NEW_EMAIL}?`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(NEW_EMAIL).tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(document.title).toBe('Confirm your email · CSPS Admin');
    expect(probe.confirmBodies).toEqual([]);
    await expectNoAxeViolations(document.body);
  });
});

describe('P3 confirming', () => {
  it('sends the token with one Idempotency-Key, shows "Confirming" while it runs, then Done with focus on the heading', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const probe = answer({
      confirm: async () => {
        await gate;
        return HttpResponse.json({ newEmail: NEW_EMAIL });
      },
    });
    renderConfirm();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));
    expect(await screen.findByRole('button', { name: 'Confirming' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      release();
      await gate;
    });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Your email is changed' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(probe.confirmBodies).toEqual([{ token: TOKEN }]);
    expect(probe.confirmKeys).toHaveLength(1);
    expect(probe.confirmKeys[0]).toMatch(/\S/);
    expect(
      screen.getByText(
        (_content, node) => node?.tagName === 'P' && node.textContent === `From now on, sign in with ${NEW_EMAIL}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to CSPS Admin' })).toHaveAttribute('href', '/admin');
    expect(window.location.hash).toBe('');
    await expectNoAxeViolations(document.body);
  });

  it('takes the person on to the admin from Done', async () => {
    const user = userEvent.setup();
    answer();
    const router = renderConfirm();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));

    await user.click(await screen.findByRole('link', { name: 'Continue to CSPS Admin' }));

    expect(await screen.findByText('The admin home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('keeps Ready with the shared banner when the confirm gets no answer, and retries with the same Idempotency-Key', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const probe = answer({
      confirm: () => {
        calls += 1;
        return calls === 1
          ? problemResponse(500, { title: 'Down', status: 500 })
          : HttpResponse.json({ newEmail: NEW_EMAIL });
      },
    });
    renderConfirm();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));
    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm New Email' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This link has expired' })).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));

    await screen.findByRole('heading', { level: 1, name: 'Your email is changed' });
    expect(probe.confirmKeys).toHaveLength(2);
    expect(probe.confirmKeys[1]).toBe(probe.confirmKeys[0]);
  });

  it('turns to the invalid state when the link stopped working between the check and the press', async () => {
    const user = userEvent.setup();
    answer({ confirm: invalidLink });
    renderConfirm();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it("turns to the can't-be-used state, naming the address, when another account took it before the press", async () => {
    const user = userEvent.setup();
    answer({ confirm: takenLink });
    renderConfirm();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));

    const heading = await screen.findByRole('heading', { level: 1, name: "This email can't be used" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' &&
          node.textContent ===
            `Another account now uses ${NEW_EMAIL}. Start the change again from My Profile with a different email.`,
      ),
    ).toBeInTheDocument();
  });

  it('keeps Ready with the banner for a 409 that is not the taken answer', async () => {
    const user = userEvent.setup();
    answer({ confirm: () => problemResponse(409, { title: 'Conflict', status: 409, code: 'edit.stale' }) });
    renderConfirm();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Confirm New Email' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm New Email' })).toBeInTheDocument();
  });
});

describe('P3 invalid, taken and failed links', () => {
  it('shows one invalid state for a link the server refuses, with focus on the heading', async () => {
    const probe = answer({ check: invalidLink });
    renderConfirm();

    const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(
      screen.getByText('Email change links work for 24 hours and only once. Start the change again from My Profile.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(screen.queryByRole('button', { name: 'Confirm New Email' })).not.toBeInTheDocument();
    expect(probe.confirmBodies).toEqual([]);
    await expectNoAxeViolations(document.body);
  });

  it("shows the can't-be-used state when the address was taken before the link was opened", async () => {
    answer({ check: takenLink });
    renderConfirm();

    const heading = await screen.findByRole('heading', { level: 1, name: "This email can't be used" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(
      screen.getByText(
        'Another account now uses this email. Start the change again from My Profile with a different email.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    expect(screen.queryByRole('button', { name: 'Confirm New Email' })).not.toBeInTheDocument();
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
          : HttpResponse.json({ newEmail: NEW_EMAIL });
      },
    });
    renderConfirm();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This link has expired' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/admin/login');
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await ready();
    expect(calls).toBe(2);
  });

  it('shows the banner, not the expired state, for a network error on the check', async () => {
    answer({ check: () => HttpResponse.error() });
    renderConfirm();

    expect(await screen.findByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This link has expired' })).not.toBeInTheDocument();
  });
});
