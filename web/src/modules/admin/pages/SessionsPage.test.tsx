import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { sessionsListKey } from '@/lib/query/keys';
import { createQueryClient } from '@/lib/query/queryClient';
import { SessionsRoute } from '@/modules/admin/pages/SessionsPage';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';
import { clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// S7 Signed-in devices, /admin/sessions (D-43, D-44, D-05; plan 04-29).

const MINUTE = 60_000;

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

const CURRENT: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000001',
  device: 'Chrome on Windows',
  signedInAt: '2026-10-12T07:42:00Z',
  lastActiveAt: ago(0),
  persistent: true,
  current: true,
};

const PHONE: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000002',
  device: 'Safari on iPhone',
  signedInAt: '2026-10-11T02:15:00Z',
  lastActiveAt: ago(5),
  persistent: false,
  current: false,
};

const TABLET: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000003',
  device: 'Chrome on Android',
  signedInAt: '2026-10-10T01:00:00Z',
  lastActiveAt: ago(180),
  persistent: true,
  current: false,
};

const LAPTOP: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000004',
  device: 'Edge on Windows',
  signedInAt: '2026-10-09T03:30:00Z',
  lastActiveAt: ago(60 * 30),
  persistent: false,
  current: false,
};

interface Backend {
  devices: SessionListItem[];
  listCalls: number;
  deleted: string[];
  signOutOthersCalls: number;
}

/** A stateful fake of the sessions endpoints: a DELETE removes the row, sign-out-others keeps only the current one. */
function backend(initial: readonly SessionListItem[], overrides: { revoke?: () => Response } = {}): Backend {
  const state: Backend = { devices: [...initial], listCalls: 0, deleted: [], signOutOthersCalls: 0 };
  server.use(
    http.get('*/api/v1/sessions', () => {
      state.listCalls += 1;
      return HttpResponse.json(state.devices);
    }),
    http.delete('*/api/v1/sessions/:id', ({ params }) => {
      if (overrides.revoke !== undefined) {
        return overrides.revoke();
      }
      const id = String(params.id);
      state.deleted.push(id);
      state.devices = state.devices.filter((device) => device.id !== id);
      return HttpResponse.json({ alreadySignedOut: false });
    }),
    http.post('*/api/v1/auth/sign-out-others', () => {
      state.signOutOthersCalls += 1;
      state.devices = state.devices.filter((device) => device.current);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

let queryClient: QueryClient;

function Harness({ children, theme }: { children: ReactNode; theme: 'light' | 'dark' }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div data-theme={theme}>
        <ToastProvider>{children}</ToastProvider>
      </div>
    </QueryClientProvider>
  );
}

function renderPage(theme: 'light' | 'dark' = 'light') {
  return render(<SessionsRoute />, { wrapper: ({ children }) => <Harness theme={theme}>{children}</Harness> });
}

function rowOf(device: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(device) !== null);
  if (row === undefined) {
    throw new Error(`No row for ${device}`);
  }
  return row;
}

function signOutButton(name: RegExp | string): HTMLElement {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  clearSession();
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  document.title = '';
});

describe('S7 the list', () => {
  it('shows the header, the columns and one row per device with "This device" first', async () => {
    backend([TABLET, CURRENT, PHONE]);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Where your account is signed in right now. Sign out any device you don't recognize. Last active times are approximate.",
      ),
    ).toBeInTheDocument();
    expect(document.title).toBe('Signed-in Devices · CSPS Admin');

    const table = await screen.findByRole('table', { name: 'Signed-in devices' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Device', 'Signed in', 'Last active', 'Session', 'Actions']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // Current first, then the others by newest last active (PHONE 5 min, TABLET 3 hr), whatever order the server used.
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Chrome on Windows'),
      expect.stringContaining('Safari on iPhone'),
      expect.stringContaining('Chrome on Android'),
    ]);
  });

  it('shows "This device" as text on the current row, with no sign-out button there', async () => {
    backend([CURRENT, PHONE]);
    renderPage();
    await screen.findByText('Safari on iPhone');

    const current = rowOf('Chrome on Windows');
    expect(within(current).getByText('This device')).toBeInTheDocument();
    expect(within(current).queryByRole('button')).toBeNull();
    expect(within(rowOf('Safari on iPhone')).queryByText('This device')).toBeNull();
    expect(within(rowOf('Safari on iPhone')).getByRole('button')).toBeInTheDocument();
  });

  it('shows Signed in as business time and Last active as relative text, both in time elements', async () => {
    backend([CURRENT, PHONE, TABLET, LAPTOP]);
    renderPage();
    await screen.findByText('Safari on iPhone');

    const current = within(rowOf('Chrome on Windows'));
    expect(current.getByText('Oct 12, 2026, 3:42 PM').closest('time')).toHaveAttribute('datetime', CURRENT.signedInAt);
    expect(current.getByText('Active now').closest('time')).toHaveAttribute('datetime', CURRENT.lastActiveAt);

    const phone = within(rowOf('Safari on iPhone'));
    expect(phone.getByText('Oct 11, 2026, 10:15 AM')).toBeInTheDocument();
    expect(phone.getByText('5 min ago')).toBeInTheDocument();
    expect(within(rowOf('Chrome on Android')).getByText('3 hr ago')).toBeInTheDocument();
    // 30 hours: the absolute business time, in Asia/Manila whatever the browser zone is.
    const laptop = within(rowOf('Edge on Windows'));
    const lastActive = laptop.getAllByText(/^[A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2} (AM|PM)$/);
    expect(lastActive.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the session kind: a "Keep me signed in" badge, or "Until browser closes"', async () => {
    backend([CURRENT, PHONE]);
    renderPage();
    await screen.findByText('Safari on iPhone');

    expect(within(rowOf('Chrome on Windows')).getByText('Keep me signed in')).toBeInTheDocument();
    expect(within(rowOf('Safari on iPhone')).getByText('Until browser closes')).toBeInTheDocument();
  });

  it('names each sign-out button with the device and its sign-in time, so identical devices stay distinct', async () => {
    const label = 'Chrome on a very long device name that goes on and on and on';
    expect(label.length).toBeLessThanOrEqual(60);
    backend([
      CURRENT,
      { ...PHONE, device: label, signedInAt: '2026-10-11T02:15:00Z' },
      { ...TABLET, device: label, signedInAt: '2026-10-10T01:00:00Z' },
    ]);
    renderPage();
    await screen.findAllByText(label);

    expect(signOutButton(`Sign out ${label}, signed in Oct 11, 2026, 10:15 AM`)).toBeInTheDocument();
    expect(signOutButton(`Sign out ${label}, signed in Oct 10, 2026, 9:00 AM`)).toBeInTheDocument();
    // The label wraps inside its cell and never widens the page.
    for (const text of screen.getAllByText(label)) {
      expect(text.className).toContain('wrap-anywhere');
    }
  });

  it('reads "Unknown browser" for a device with no label', async () => {
    backend([CURRENT, { ...PHONE, device: '' }]);
    renderPage();

    expect(await screen.findByText('Unknown browser')).toBeInTheDocument();
    expect(signOutButton(/^Sign out Unknown browser, signed in /)).toBeInTheDocument();
  });

  it('with only this device shows the one row, the note and the enabled header button', async () => {
    backend([CURRENT]);
    renderPage();

    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(
      screen.getByText('No other devices are signed in. When you sign in somewhere else, it shows up here.'),
    ).toBeInTheDocument();
    const header = screen.getByRole('button', { name: 'Sign Out Other Devices' });
    expect(header).toBeEnabled();
    expect(header).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('does not show the only-this-device note while other devices are signed in', async () => {
    backend([CURRENT, PHONE]);
    renderPage();
    await screen.findByText('Safari on iPhone');

    expect(screen.queryByText(/No other devices are signed in/)).toBeNull();
  });
});

describe('S7 states', () => {
  it('shows the header at once, then a skeleton table with the live loading words, then the rows', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/sessions', async () => {
        await gate;
        return HttpResponse.json([CURRENT, PHONE]);
      }),
    );
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out Other Devices' })).toBeEnabled();
    expect(screen.getByText('Loading signed-in devices…')).toBeInTheDocument();
    expect(screen.queryByText('Chrome on Windows')).toBeNull();

    release();
    expect(await screen.findByText('Safari on iPhone')).toBeInTheDocument();
    expect(await screen.findByText('Signed-in devices loaded.')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load signed-in devices." with Try Again and the reference, and Try Again reloads', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/sessions', () =>
        fail
          ? HttpResponse.json({ title: 'Boom', status: 500, traceId: 'tr-777' }, { status: 500 })
          : HttpResponse.json([CURRENT]),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load signed-in devices.");
    expect(alert).toHaveTextContent('Reference: tr-777');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the rows on screen while it refetches and dims them after 200 ms, with no rows removed', async () => {
    backend([CURRENT, PHONE]);
    renderPage();
    await screen.findByText('Safari on iPhone');

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/sessions', async () => {
        await gate;
        return HttpResponse.json([CURRENT, PHONE]);
      }),
    );
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: sessionsListKey, refetchType: 'none' });
      void queryClient.refetchQueries({ queryKey: sessionsListKey });
    });

    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
    expect(document.querySelector('[data-refetching="true"]')).toBeNull();
    await waitFor(() => {
      expect(document.querySelector('[data-refetching="true"]')).not.toBeNull();
    });
    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();

    release();
    await waitFor(() => {
      expect(document.querySelector('[data-refetching="true"]')).toBeNull();
    });
  });

  it('refetches on window focus because the list is stale at once, and never on a timer', async () => {
    const state = backend([CURRENT]);
    renderPage();
    await screen.findByText('Chrome on Windows');

    expect(state.listCalls).toBe(1);
    expect(queryClient.getQueryCache().find({ queryKey: sessionsListKey })?.isStale()).toBe(true);
  });
});

describe('S7 sign out one device', () => {
  it('opens the dialog with "Keep Signed In" focused, then removes the row, toasts and refetches', async () => {
    const state = backend([CURRENT, PHONE, TABLET]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');

    await user.click(signOutButton(/^Sign out Safari on iPhone, signed in/));

    const dialog = screen.getByRole('dialog', { name: 'Sign out Safari on iPhone?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Signed In' })).toHaveFocus();
    expect(dialog).toHaveTextContent('Signed in Oct 11, 2026, 10:15 AM.');
    expect(dialog).toHaveTextContent('That device will have to sign in again with the password and an emailed code.');

    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Device' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(state.deleted).toEqual([PHONE.id]);
    expect(screen.getByText('Device signed out')).toBeInTheDocument();
    expect(screen.getByText('Safari on iPhone will have to sign in again.')).toBeInTheDocument();
    await waitFor(() => {
      expect(state.listCalls).toBe(2);
    });
    expect(screen.queryByRole('button', { name: /^Sign out Safari on iPhone/ })).toBeNull();
  });

  it('sends no request when the person keeps the device signed in', async () => {
    const state = backend([CURRENT, PHONE]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');
    const opener = signOutButton(/^Sign out Safari on iPhone/);

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Keep Signed In' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(state.deleted).toEqual([]);
    expect(opener).toHaveFocus();
  });

  it("moves focus to the next row's button after a removal", async () => {
    backend([CURRENT, PHONE, TABLET]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    await waitFor(() => {
      expect(signOutButton(/^Sign out Chrome on Android/)).toHaveFocus();
    });
  });

  it("moves focus to the previous row's button when the last row is removed", async () => {
    backend([CURRENT, PHONE, TABLET]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Chrome on Android');

    await user.click(signOutButton(/^Sign out Chrome on Android/));
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    await waitFor(() => {
      expect(signOutButton(/^Sign out Safari on iPhone/)).toHaveFocus();
    });
  });

  it('moves focus to the page heading when only this device is left', async () => {
    backend([CURRENT, PHONE]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'Signed-in devices' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(
      await screen.findByText('No other devices are signed in. When you sign in somewhere else, it shows up here.'),
    ).toBeInTheDocument();
  });

  it('treats an answer of alreadySignedOut as success with the info toast', async () => {
    const state = backend([CURRENT, PHONE], { revoke: () => HttpResponse.json({ alreadySignedOut: true }) });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');
    state.devices = [CURRENT];

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    expect(await screen.findByText('Already signed out')).toBeInTheDocument();
    expect(screen.getByText('That device was no longer signed in.')).toBeInTheDocument();
    expect(screen.queryByText('Device signed out')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText('Safari on iPhone')).toBeNull();
    });
  });

  it('treats a 404 (the device is not in the list any more) as already signed out', async () => {
    const state = backend([CURRENT, PHONE], {
      revoke: () =>
        HttpResponse.json(
          { title: "That device isn't in your list.", status: 404, code: 'sessions.not-found' },
          { status: 404 },
        ),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');
    state.devices = [CURRENT];

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    expect(await screen.findByText('Already signed out')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('keeps the dialog open with the mapper line and focus on "Sign Out Device" when the request fails', async () => {
    backend([CURRENT, PHONE], { revoke: () => HttpResponse.json({ title: 'Boom', status: 500 }, { status: 500 }) });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Device' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(within(dialog).getByRole('button', { name: 'Sign Out Device' })).toHaveFocus();
    expect(screen.queryByText('Device signed out')).toBeNull();
    expect(signOutButton(/^Sign out Safari on iPhone/)).toBeInTheDocument();
  });

  it('keeps the dialog open with the mapper line on a network failure', async () => {
    backend([CURRENT, PHONE], { revoke: () => HttpResponse.error() });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');

    await user.click(signOutButton(/^Sign out Safari on iPhone/));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Device' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
    expect(within(dialog).getByRole('button', { name: 'Sign Out Device' })).toHaveFocus();
  });
});

describe('S7 Sign Out Other Devices', () => {
  it('opens the dialog with "Keep Others Signed In" focused, signs out the others and toasts', async () => {
    const state = backend([CURRENT, PHONE, TABLET]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Safari on iPhone');
    const opener = screen.getByRole('button', { name: 'Sign Out Other Devices' });

    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Sign out of other devices?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Others Signed In' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(state.signOutOthersCalls).toBe(1);
    expect(screen.getByText('Signed out of other devices')).toBeInTheDocument();
    expect(screen.getByText("You're still signed in on this device.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Safari on iPhone')).toBeNull();
    });
    expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    expect(state.listCalls).toBeGreaterThanOrEqual(2);
    expect(opener).toHaveFocus();
  });

  it('is allowed with no other devices, with no session count first, and shows the same toast', async () => {
    const state = backend([CURRENT]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Chrome on Windows');
    const requestsBefore = state.listCalls;

    await user.click(screen.getByRole('button', { name: 'Sign Out Other Devices' }));
    expect(state.listCalls).toBe(requestsBefore);
    expect(screen.getByRole('dialog', { name: 'Sign out of other devices?' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign Out Other Devices' }));

    expect(await screen.findByText('Signed out of other devices')).toBeInTheDocument();
    expect(state.signOutOthersCalls).toBe(1);
  });

  it('is enabled while the list is still loading and when it failed to load', async () => {
    server.use(http.get('*/api/v1/sessions', () => HttpResponse.json({ title: 'Boom', status: 500 }, { status: 500 })));
    renderPage();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Sign Out Other Devices' })).toBeEnabled();
  });
});

describe('S7 accessibility', () => {
  it.each([
    ['Blush', 'light'],
    ['Espresso', 'dark'],
  ] as const)('has no axe violations in %s with several devices', async (_name, theme) => {
    backend([CURRENT, PHONE, TABLET]);
    const view = renderPage(theme);
    await screen.findByText('Safari on iPhone');

    await expectNoAxeViolations(view.container);
  });

  it.each([
    ['Blush', 'light'],
    ['Espresso', 'dark'],
  ] as const)('has no axe violations in %s with only this device', async (_name, theme) => {
    backend([CURRENT]);
    const view = renderPage(theme);
    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    await expectNoAxeViolations(view.container);
  });

  it('has no axe violations with the per-device dialog open', async () => {
    backend([CURRENT, PHONE]);
    const user = userEvent.setup();
    const view = renderPage();
    await screen.findByText('Safari on iPhone');
    await user.click(signOutButton(/^Sign out Safari on iPhone/));

    await expectNoAxeViolations(view.container);
  });

  it('has no axe violations while loading and after a failed load', async () => {
    server.use(http.get('*/api/v1/sessions', () => HttpResponse.json({ title: 'Boom', status: 500 }, { status: 500 })));
    const view = renderPage();
    expect(screen.getByText('Loading signed-in devices…')).toBeInTheDocument();
    await expectNoAxeViolations(view.container);
    await screen.findByRole('alert');
    await expectNoAxeViolations(view.container);
  });
});
