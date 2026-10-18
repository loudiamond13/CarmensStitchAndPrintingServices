import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { profileKey } from '@/lib/query/keys';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useThemeState } from '@/modules/admin/hooks/useAdminTheme';
import { ProfileRoute } from '@/modules/admin/pages/ProfilePage';
import type { ProfileResponse } from '@/modules/admin/services/profileService';
import { clearSession, getSessionUser } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// P1 My Profile, /admin/profile (PROF-01, D-23, OR-3; plan 05-13): the header, the tabs and the name save.

const V1 = '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3';
const V2 = '1c1f2d3b-4e50-4b6c-9d7e-8f9a01b2c3d4';
const V3 = '2d203e4c-5f61-4c7d-8e8f-9a0b12c3d4e5';

const PROFILE: ProfileResponse = {
  id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  firstName: 'Carmen',
  lastName: 'Reyes',
  email: 'carmen@example.ph',
  role: 'Manager',
  pendingEmail: null,
  memberSince: '2026-10-17T01:00:00Z',
  version: V1,
};

interface SavedName {
  firstName: string;
  lastName: string;
  version: string;
}

interface Backend {
  profile: ProfileResponse;
  gets: number;
  puts: SavedName[];
  /** How many times the session was refreshed, which is how the shell learns the new name. */
  refreshes: number;
}

interface BackendOptions {
  /** Replaces the PUT answer; the default saves the names and rotates the version. */
  put?: (body: SavedName) => Response | Promise<Response>;
  /** Replaces the GET answer. */
  get?: () => Response | Promise<Response>;
}

/** A stateful fake of GET and PUT /api/v1/profile, and of the session refresh the save triggers. */
function backend(initial: ProfileResponse = PROFILE, options: BackendOptions = {}): Backend {
  const versions = [V2, V3];
  const state: Backend = { profile: { ...initial }, gets: 0, puts: [], refreshes: 0 };
  server.use(
    http.get('*/api/v1/profile', () => {
      state.gets += 1;
      return options.get !== undefined ? options.get() : HttpResponse.json(state.profile);
    }),
    http.post('*/api/v1/auth/refresh', () => {
      state.refreshes += 1;
      const { profile } = state;
      return HttpResponse.json(
        sessionResponse({
          user: {
            id: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            role: profile.role,
          },
        }),
      );
    }),
    http.put('*/api/v1/profile', async ({ request }) => {
      const body = (await request.json()) as SavedName;
      state.puts.push(body);
      if (options.put !== undefined) {
        return options.put(body);
      }
      state.profile = {
        ...state.profile,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        version: versions.shift() ?? V3,
      };
      return HttpResponse.json(state.profile);
    }),
  );
  return state;
}

function problem(status: number, body: Record<string, unknown>): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

let queryClient: QueryClient;

/**
 * The admin layout's part of the theme: the page root with data-theme, the theme state the layout owns, and the Outlet
 * context the page reads it from. The "top bar" button stands for the real toggle, which changes the same state.
 */
function ThemeHost() {
  const context = useThemeState();
  return (
    <div data-theme={context.theme}>
      <button
        type="button"
        onClick={() => {
          context.setTheme(context.theme === 'light' ? 'dark' : 'light');
        }}
      >
        Top bar toggle
      </button>
      <ToastProvider>
        <Outlet context={context} />
      </ToastProvider>
    </div>
  );
}

function Harness({ search }: { search: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <Routes>
            <Route element={<ThemeHost />}>
              <Route path="*" element={<ProfileRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '') {
  return render(<Harness search={search} />);
}

async function openPage(search = '') {
  const view = renderPage(search);
  await screen.findByRole('heading', { level: 1, name: 'Carmen Reyes' });
  return view;
}

function firstName(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'First name' });
}

function lastName(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Last name' });
}

beforeEach(() => {
  window.localStorage.clear();
  clearSession();
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  document.title = '';
});

describe('P1 the header', () => {
  it('shows the name, the role badge and "{email} · Member since {date}" in the business zone', async () => {
    backend();
    await openPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Carmen Reyes' })).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('carmen@example.ph · Member since Oct 17, 2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Carmen Reyes' })).toHaveTextContent('CR');
  });

  it('shows the Admin badge for an Admin', async () => {
    backend({ ...PROFILE, role: 'Admin' });
    await openPage();

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByText('Manager')).toBeNull();
  });

  it('shows the current sign-in email while a change is pending', async () => {
    backend({ ...PROFILE, pendingEmail: 'new@example.ph' });
    await openPage();

    expect(screen.getByText('carmen@example.ph · Member since Oct 17, 2026')).toBeInTheDocument();
  });

  it('sets the document title to "My Profile · CSPS Admin"', async () => {
    backend();
    await openPage();

    expect(document.title).toBe('My Profile · CSPS Admin');
  });
});

describe('P1 loading and failure', () => {
  it('announces "Loading your profile…" and then "Profile loaded."', async () => {
    backend();
    renderPage();

    expect(await screen.findByText('Loading your profile…')).toBeInTheDocument();
    expect(await screen.findByText('Profile loaded.')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load your profile." with Try Again, and Try Again reads the profile again', async () => {
    let fail = true;
    server.use(http.get('*/api/v1/profile', () => (fail ? problem(500, {}) : HttpResponse.json(PROFILE))));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't load your profile.")).toBeInTheDocument();

    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Carmen Reyes' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('P1 the tabs (D-23)', () => {
  it('lists Details, Security and Appearance with Details selected and its panel shown', async () => {
    backend();
    await openPage();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Details', 'Security', 'Appearance']);
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName('Details');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Personal Information' })).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys, Home and End, and the panel follows', async () => {
    backend();
    await openPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Details' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Security' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Security');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Appearance');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('puts only the selected tab in the Tab order (roving tabindex)', async () => {
    backend();
    await openPage('?tab=security');

    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('tabindex', '-1');
  });

  it('opens the tab named in the URL', async () => {
    backend();
    await openPage('?tab=security');

    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Security');
  });

  it('shows Details for an invalid tab in the URL', async () => {
    backend();
    await openPage('?tab=bogus');

    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  });

  it('shows the Signed-in Devices card on the Security tab with a link to /admin/sessions', async () => {
    backend();
    await openPage('?tab=security');

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Signed-in Devices' })).toBeInTheDocument();
    expect(
      within(panel).getByText("See where your account is signed in, and sign out devices you don't recognize."),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'View Signed-in Devices' })).toHaveAttribute(
      'href',
      '/admin/sessions',
    );
  });
});

describe('P1 Details: Personal Information (PROF-01, OR-3)', () => {
  it('shows the card with both names filled in and the right autocomplete hints', async () => {
    backend();
    await openPage();

    expect(screen.getByText('Shown on orders and expenses you record.')).toBeInTheDocument();
    expect(firstName()).toHaveValue('Carmen');
    expect(firstName()).toHaveAttribute('autocomplete', 'given-name');
    expect(lastName()).toHaveValue('Reyes');
    expect(lastName()).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('saves the new name with the loaded version, shows "Saving" meanwhile, then the toast and the new header', async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = backend(PROFILE, {
      put: async (body) => {
        await held;
        return HttpResponse.json({ ...PROFILE, firstName: body.firstName, lastName: body.lastName, version: V2 });
      },
    });
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('button', { name: 'Saving' })).toHaveAttribute('aria-disabled', 'true');
    release();

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    expect(screen.getByText('Your name is updated.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Ana Reyes' })).toBeInTheDocument();
    expect(state.puts).toEqual([{ firstName: 'Ana', lastName: 'Reyes', version: V1 }]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('sends the version the last save returned with the next save', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('heading', { level: 1, name: 'Ana Reyes' });

    await user.clear(lastName());
    await user.type(lastName(), 'Cruz');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('heading', { level: 1, name: 'Ana Cruz' });

    expect(state.puts).toEqual([
      { firstName: 'Ana', lastName: 'Reyes', version: V1 },
      { firstName: 'Ana', lastName: 'Cruz', version: V2 },
    ]);
  });

  it('sends the names trimmed', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), '  Ana  ');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('heading', { level: 1, name: 'Ana Reyes' });

    expect(state.puts[0]).toMatchObject({ firstName: 'Ana' });
    expect(firstName()).toHaveValue('Ana');
  });

  it('shows "Enter a first name." before any request, and puts the cursor in the field', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(firstName()).toHaveAttribute('aria-invalid', 'true');
    expect(firstName()).toHaveFocus();
    expect(state.puts).toHaveLength(0);
  });

  it('shows both name errors at once for two blank names', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.clear(lastName());
    await user.type(lastName(), '   ');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a last name.')).toBeInTheDocument();
    expect(state.puts).toHaveLength(0);
  });

  it('refuses a 101-character name inline before any request', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(lastName());
    await user.click(lastName());
    await user.paste('b'.repeat(101));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Last name must be 100 characters or fewer.')).toBeInTheDocument();
    expect(state.puts).toHaveLength(0);
  });

  it('lets a server field error win and shows it under the field', async () => {
    backend(PROFILE, {
      put: () => problem(400, { errors: { FirstName: ['Enter a first name.'] } }),
    });
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(firstName()).toHaveAttribute('aria-invalid', 'true');
    expect(firstName()).toHaveValue('Ana');
  });

  it('shows a danger toast and keeps what was typed when the server fails', async () => {
    backend(PROFILE, { put: () => problem(500, {}) });
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(firstName()).toHaveValue('Ana');
    expect(screen.getByRole('heading', { level: 1, name: 'Carmen Reyes' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Changes' })).not.toHaveAttribute('aria-disabled');
    });
  });
});

describe('P1 the shell learns the new name (PROF-01)', () => {
  it('refreshes the session once after a successful save, so the session user has the new name', async () => {
    const state = backend();
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Changes saved');

    await waitFor(() => {
      expect(getSessionUser()?.name).toBe('Ana Reyes');
    });
    expect(state.refreshes).toBe(1);
  });

  it('does not refresh the session when the save fails', async () => {
    const state = backend(PROFILE, { put: () => problem(500, {}) });
    await openPage();
    const user = userEvent.setup();

    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Something went wrong');

    expect(state.refreshes).toBe(0);
  });
});

describe('P1 stale save (D-20, SEC-07)', () => {
  const STALE_BODY = { code: 'edit.stale', detail: 'This was changed by someone else.' };
  const NEWER: ProfileResponse = { ...PROFILE, firstName: 'Lito', lastName: 'Cruz', version: V2 };

  /** A backend whose saves are refused as stale until `accept()`; `elsewhere()` makes the stored profile the newer one. */
  function staleBackend(get?: (stored: ProfileResponse) => Response | Promise<Response>) {
    let stale = true;
    const state: Backend = backend(PROFILE, {
      ...(get === undefined ? {} : { get: () => get(state.profile) }),
      put: (body) => {
        if (stale) {
          return problem(409, STALE_BODY);
        }
        state.profile = { ...state.profile, firstName: body.firstName, lastName: body.lastName, version: V3 };
        return HttpResponse.json(state.profile);
      },
    });
    return {
      state,
      /** Someone else saved first. */
      elsewhere: () => {
        state.profile = NEWER;
      },
      accept: () => {
        stale = false;
      },
    };
  }

  async function saveAs(name: string): Promise<void> {
    const user = userEvent.setup();
    await user.clear(firstName());
    await user.type(firstName(), name);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  }

  it('keeps the typed names, shows the banner with focus on Load Latest, and raises no toast or refresh', async () => {
    const { state } = staleBackend();
    await openPage();

    await saveAs('Ana');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('This was changed by someone else.')).toBeInTheDocument();
    expect(
      within(alert).getByText('Reload and try again. Your typed changes stay here until you press Load Latest.'),
    ).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    expect(firstName()).toHaveValue('Ana');
    expect(lastName()).toHaveValue('Reyes');
    expect(screen.queryByText('Someone else changed this')).toBeNull();
    expect(screen.queryByText('Changes saved')).toBeNull();
    expect(state.refreshes).toBe(0);
  });

  it('shows the banner inside the Personal Information card, above the fields', async () => {
    staleBackend();
    await openPage();

    await saveAs('Ana');

    const alert = await screen.findByRole('alert');
    const form = screen.getByRole('form', { name: 'Personal Information' });
    expect(form).toContainElement(alert);
    expect(alert.compareDocumentPosition(firstName()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Load Latest fetches the profile, replaces the names and the version, removes the banner and focuses First name', async () => {
    const { state, elsewhere, accept } = staleBackend();
    await openPage();
    await saveAs('Ana');
    await screen.findByRole('alert');
    elsewhere();
    const getsBefore = state.gets;

    await userEvent.click(screen.getByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(state.gets).toBe(getsBefore + 1);
    expect(firstName()).toHaveValue('Lito');
    expect(lastName()).toHaveValue('Cruz');
    expect(firstName()).toHaveFocus();
    const status = screen.getByText('Latest version loaded. Make your changes again.');
    expect(status.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('heading', { level: 1, name: 'Lito Cruz' })).toBeInTheDocument();

    accept();
    const user = userEvent.setup();
    await user.clear(firstName());
    await user.type(firstName(), 'Lito Jr');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Changes saved');
    expect(state.puts.at(-1)).toEqual({ firstName: 'Lito Jr', lastName: 'Cruz', version: V2 });
  });

  it('shows "Loading" on Load Latest while the profile is on its way, and keeps the typed names until it arrives', async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let hold = false;
    const { elsewhere } = staleBackend(async (stored) => {
      if (hold) {
        await held;
      }
      return HttpResponse.json(stored);
    });
    await openPage();
    await saveAs('Ana');
    await screen.findByRole('alert');
    elsewhere();
    hold = true;

    await userEvent.click(screen.getByRole('button', { name: 'Load Latest' }));

    expect(await screen.findByRole('button', { name: 'Loading' })).toHaveAttribute('aria-disabled', 'true');
    expect(firstName()).toHaveValue('Ana');
    release();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(firstName()).toHaveValue('Lito');
  });

  it('keeps the banner and the typed names, with a danger toast, when Load Latest cannot reach the server', async () => {
    let fail = false;
    const { elsewhere } = staleBackend((stored) => (fail ? problem(500, {}) : HttpResponse.json(stored)));
    await openPage();
    await saveAs('Ana');
    await screen.findByRole('alert');
    elsewhere();
    fail = true;

    await userEvent.click(screen.getByRole('button', { name: 'Load Latest' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(firstName()).toHaveValue('Ana');
    expect(screen.queryByText('Latest version loaded. Make your changes again.')).toBeNull();
  });

  it('never replaces typed names on its own: a profile changed elsewhere reaches the header, not the open form', async () => {
    const { state, elsewhere } = staleBackend();
    await openPage();
    const user = userEvent.setup();
    await user.clear(firstName());
    await user.type(firstName(), 'Ana');
    elsewhere();

    await queryClient.refetchQueries({ queryKey: profileKey });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lito Cruz' })).toBeInTheDocument();
    expect(firstName()).toHaveValue('Ana');
    expect(lastName()).toHaveValue('Reyes');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(state.puts).toEqual([{ firstName: 'Ana', lastName: 'Reyes', version: V1 }]);
  });

  it('keeps one banner, and moves focus to Load Latest again, when a second save is also stale', async () => {
    staleBackend();
    await openPage();
    await saveAs('Ana');
    await screen.findByRole('alert');
    const user = userEvent.setup();

    await user.click(firstName());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(firstName()).toHaveValue('Ana');
  });

  it('shows the ordinary conflict toast, not the banner, for a 409 that is not a stale edit', async () => {
    backend(PROFILE, { put: () => problem(409, { code: 'auth.session-busy' }) });
    await openPage();

    await saveAs('Ana');

    expect(await screen.findByText('Someone else changed this')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(firstName()).toHaveValue('Ana');
  });

  it('has no axe violations with the banner showing', async () => {
    staleBackend();
    const { container } = await openPage();
    await saveAs('Ana');
    await screen.findByRole('alert');

    await expectNoAxeViolations(container);
  });
});

describe('P1 Appearance: Theme (PROF-04, D-22)', () => {
  function pageRoot(): HTMLElement {
    const root = document.querySelector('[data-theme]');
    if (!(root instanceof HTMLElement)) {
      throw new Error('No page root.');
    }
    return root;
  }

  function blush(): HTMLElement {
    return screen.getByRole('radio', { name: 'Blush (light)' });
  }

  function espresso(): HTMLElement {
    return screen.getByRole('radio', { name: 'Espresso (dark)' });
  }

  /** The polite line the Appearance card reads out. */
  function themeStatus(): string {
    const panel = screen.getByRole('tabpanel');
    return within(panel).getAllByRole('status')[0]?.textContent ?? '';
  }

  it('shows the Theme card with the two choices, the hint and no save button', async () => {
    backend();
    await openPage('?tab=appearance');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName('Appearance');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Theme' })).toBeInTheDocument();
    expect(within(panel).getByText('Choose how CSPS Admin looks on this browser.')).toBeInTheDocument();
    expect(within(panel).getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(blush()).toHaveTextContent('Blush (light)');
    expect(espresso()).toHaveTextContent('Espresso (dark)');
    expect(
      within(panel).getByText('Saved on this browser only. The public website always stays light.'),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /save/i })).toBeNull();
  });

  it('starts on Blush with nothing saved', async () => {
    backend();
    await openPage('?tab=appearance');

    expect(blush()).toHaveAttribute('aria-checked', 'true');
    expect(espresso()).toHaveAttribute('aria-checked', 'false');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });

  it('starts on Espresso when "dark" is saved', async () => {
    window.localStorage.setItem('csps-theme', 'dark');
    backend();
    await openPage('?tab=appearance');

    expect(espresso()).toHaveAttribute('aria-checked', 'true');
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
  });

  it.each(['purple', 'DARK', 'light ', ''])('reads the stored value %j as Blush', async (stored) => {
    window.localStorage.setItem('csps-theme', stored);
    backend();
    await openPage('?tab=appearance');

    expect(blush()).toHaveAttribute('aria-checked', 'true');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });

  it('applies Espresso at once, saves "dark" in this browser and announces it', async () => {
    const state = backend();
    await openPage('?tab=appearance');

    await userEvent.click(espresso());

    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
    expect(espresso()).toHaveAttribute('aria-checked', 'true');
    expect(themeStatus()).toBe('Theme changed to Espresso (dark).');
    expect(screen.getByText('Theme changed to Espresso (dark).').closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    // The theme is never sent to the server (D-22).
    expect(state.puts).toHaveLength(0);
  });

  it('switches back to Blush and announces that', async () => {
    backend();
    await openPage('?tab=appearance');
    await userEvent.click(espresso());

    await userEvent.click(blush());

    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('csps-theme')).toBe('light');
    expect(themeStatus()).toBe('Theme changed to Blush (light).');
  });

  it('changes nothing, writes nothing and announces nothing when the active theme is chosen again', async () => {
    backend();
    await openPage('?tab=appearance');
    const write = vi.spyOn(Storage.prototype, 'setItem');

    await userEvent.click(blush());

    expect(write).not.toHaveBeenCalled();
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(themeStatus()).toBe('');

    await userEvent.click(espresso());
    write.mockClear();
    await userEvent.click(espresso());
    expect(write).not.toHaveBeenCalled();
    expect(themeStatus()).toBe('Theme changed to Espresso (dark).');
  });

  it('follows a change made somewhere else, such as the top bar toggle, and stops announcing the old change', async () => {
    backend();
    await openPage('?tab=appearance');
    await userEvent.click(espresso());
    expect(themeStatus()).toBe('Theme changed to Espresso (dark).');

    await userEvent.click(screen.getByRole('button', { name: 'Top bar toggle' }));

    expect(blush()).toHaveAttribute('aria-checked', 'true');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(themeStatus()).toBe('');
  });

  it('keeps working in memory when the storage refuses to read or write', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    backend();
    await openPage('?tab=appearance');
    expect(blush()).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(espresso());

    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    expect(espresso()).toHaveAttribute('aria-checked', 'true');
    expect(themeStatus()).toBe('Theme changed to Espresso (dark).');
  });

  it('moves between the two choices with the arrow keys', async () => {
    backend();
    await openPage('?tab=appearance');
    blush().focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(espresso()).toHaveAttribute('aria-checked', 'true');
    expect(espresso()).toHaveFocus();
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
  });

  it('has no axe violations on the Appearance tab, in either theme', async () => {
    backend();
    const { container } = await openPage('?tab=appearance');
    await expectNoAxeViolations(container);

    await userEvent.click(espresso());
    await expectNoAxeViolations(container);
  });
});

describe('P1 accessibility', () => {
  it('has no axe violations on the Details tab', async () => {
    backend();
    const { container } = await openPage();

    await expectNoAxeViolations(container);
  });

  it('has no axe violations on the Security tab', async () => {
    backend();
    const { container } = await openPage('?tab=security');

    await expectNoAxeViolations(container);
  });

  it('has no axe violations with a field error showing', async () => {
    backend();
    const { container } = await openPage();
    await userEvent.clear(firstName());
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Enter a first name.');

    await expectNoAxeViolations(container);
  });
});
