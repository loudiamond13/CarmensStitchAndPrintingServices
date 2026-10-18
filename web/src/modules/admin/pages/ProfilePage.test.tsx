import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { ProfileRoute } from '@/modules/admin/pages/ProfilePage';
import type { ProfileResponse } from '@/modules/admin/services/profileService';
import { clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

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
}

interface BackendOptions {
  /** Replaces the PUT answer; the default saves the names and rotates the version. */
  put?: (body: SavedName) => Response | Promise<Response>;
}

/** A stateful fake of GET and PUT /api/v1/profile. */
function backend(initial: ProfileResponse = PROFILE, options: BackendOptions = {}): Backend {
  const versions = [V2, V3];
  const state: Backend = { profile: { ...initial }, gets: 0, puts: [] };
  server.use(
    http.get('*/api/v1/profile', () => {
      state.gets += 1;
      return HttpResponse.json(state.profile);
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

function Harness({ children, search }: { children: ReactNode; search: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <div data-theme="light">
            <ToastProvider>{children}</ToastProvider>
          </div>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '') {
  return render(<ProfileRoute />, { wrapper: ({ children }) => <Harness search={search}>{children}</Harness> });
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
