import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { EditUserPanel } from '@/modules/admin/components/EditUserPanel';
import type { UserDetailResponse } from '@/modules/admin/services/usersService';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// U3 Edit User slide-over (USER-03, USER-05, D-45, OR-3; plan 05-25): load the person, edit names, email and role against the
// edit version, and choose how a changed email applies.

const ID = '00000000-0000-4000-8000-000000000002';
const VERSION = '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3';
const NEXT_VERSION = '1f1f1f1f-2222-4333-8444-555566667777';
const PROBLEM = { 'Content-Type': 'application/problem+json' };

function detail(overrides: Partial<UserDetailResponse> = {}): UserDetailResponse {
  return {
    id: ID,
    firstName: 'Paolo',
    lastName: 'Garcia',
    email: 'paolo@example.ph',
    role: 'Admin',
    status: 'active',
    inviteState: 'none',
    hasPassword: true,
    managerLocked: false,
    pendingEmail: null,
    createdAt: '2026-10-17T01:00:00Z',
    updatedAt: null,
    version: VERSION,
    recordedBy: null,
    lastChangedBy: null,
    ...overrides,
  };
}

interface Backend {
  puts: unknown[];
  gets: number;
}

/** Answers GET and PUT /users/{id}; the PUT echoes the body into the saved person with the next version. */
function backend(
  loaded: UserDetailResponse = detail(),
  options: { getDelay?: number; put?: (body: Record<string, unknown>) => Response | undefined } = {},
): Backend {
  const seen: Backend = { puts: [], gets: 0 };
  server.use(
    http.get('*/api/v1/users/:id', async () => {
      seen.gets += 1;
      if (options.getDelay !== undefined) {
        await delay(options.getDelay);
      }
      return HttpResponse.json(loaded);
    }),
    http.put('*/api/v1/users/:id', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      seen.puts.push(body);
      const custom = options.put?.(body);
      if (custom !== undefined) {
        return custom;
      }
      return HttpResponse.json({
        ...loaded,
        firstName: String(body.firstName),
        lastName: String(body.lastName),
        role: String(body.role),
        version: NEXT_VERSION,
      });
    }),
  );
  return seen;
}

function problem(status: number, body: Record<string, unknown> = {}): Response {
  return HttpResponse.json({ title: 'x', status, ...body }, { status, headers: PROBLEM });
}

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasTone(badge: HTMLElement, tone: keyof typeof badgeToneClasses): boolean {
  return tokens(badgeToneClasses[tone]).every((token) => tokens(badge.className).includes(token));
}

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderPanel(handlers: { onClose?: () => void; onSaved?: (saved: unknown) => void } = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EditUserPanel userId={ID} onClose={onClose} onSaved={onSaved} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

const firstName = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^First name/ });
const lastName = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Last name/ });
const email = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Email/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Changes|Saving)$/ });

/** Opens the panel and waits until the person is loaded into the form. */
async function openLoaded(loaded: UserDetailResponse = detail()) {
  const seen = backend(loaded);
  const handlers = renderPanel();
  await waitFor(() => {
    expect(firstName()).toHaveValue(loaded.firstName);
  });
  return { seen, ...handlers };
}

async function replaceEmail(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.clear(email());
  await user.type(email(), value);
}

describe('U3 loading the person', () => {
  it('opens as the "Edit User" slide-over and announces the load while a skeleton shows', async () => {
    backend(detail(), { getDelay: 80 });
    renderPanel();

    const dialog = screen.getByRole('dialog', { name: 'Edit User' });
    expect(within(dialog).getByText('Update details or change their role.')).toBeInTheDocument();
    expect(screen.getByText('Loading user details…')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^First name/ })).toBeNull();

    expect(await screen.findByText('User details loaded.')).toBeInTheDocument();
  });

  it("fills the form with the person's values and puts focus on First name", async () => {
    await openLoaded();

    expect(firstName()).toHaveFocus();
    expect(lastName()).toHaveValue('Garcia');
    expect(email()).toHaveValue('paolo@example.ph');
    expect(screen.getByRole('radio', { name: 'Admin' })).toBeChecked();
    expect(screen.getByText("They'll use this to sign in.")).toBeInTheDocument();
    expect(screen.getByText('Admins manage orders and company expenses.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('reads the person fresh on every open', async () => {
    const seen = backend();
    renderPanel();
    await screen.findByDisplayValue('Paolo');

    expect(seen.gets).toBe(1);
  });

  it('shows the status line: role, status and the invitation badge in the table tones', async () => {
    await openLoaded(detail({ role: 'Manager', status: 'locked', inviteState: 'pending', hasPassword: false }));

    const dialog = screen.getByRole('dialog', { name: 'Edit User' });
    const roleBadge = within(dialog)
      .getAllByText('Manager')
      .find((element) => hasTone(element, 'accent'));
    expect(roleBadge).toBeDefined();
    expect(hasTone(within(dialog).getByText('Locked'), 'warning')).toBe(true);
    expect(hasTone(within(dialog).getByText('Invite pending'), 'info')).toBe(true);
  });

  it('has no axe violations once loaded', async () => {
    await openLoaded();

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 changing the role (USER-05)', () => {
  it('shows the sign-out note while Role differs from the saved role, and hides it again when it matches', async () => {
    const user = userEvent.setup();
    await openLoaded();
    expect(screen.queryByText(/signs .* out on every device/)).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Manager' }));

    expect(screen.getByText('Changing the role signs Paolo out on every device.')).toBeInTheDocument();
    expect(
      screen.getByText('Managers can do everything Admins can, plus add, edit and remove users.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Admin' }));

    expect(screen.queryByText(/signs .* out on every device/)).toBeNull();
  });
});

describe('U3 checks before sending (OR-3)', () => {
  it('shows the blank-name messages, sends nothing, keeps Save Changes enabled and focuses First name', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await user.clear(firstName());
    await user.clear(lastName());

    await user.click(saveButton());

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a last name.')).toBeInTheDocument();
    expect(firstName()).toHaveAttribute('aria-invalid', 'true');
    expect(firstName()).toHaveFocus();
    expect(saveButton()).toBeEnabled();
    expect(seen.puts).toHaveLength(0);
  });

  it('refuses a misshapen email before any request', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await replaceEmail(user, 'paolo@');

    await user.click(saveButton());

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(email()).toHaveFocus();
    expect(seen.puts).toHaveLength(0);
  });
});

describe('U3 saving (USER-03)', () => {
  it('sends the new names and role with the loaded version and the saved email, then reports the saved person', async () => {
    const user = userEvent.setup();
    const { seen, onSaved } = await openLoaded();
    await user.clear(firstName());
    await user.type(firstName(), 'Paulo');
    await user.click(screen.getByRole('radio', { name: 'Manager' }));

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(seen.puts).toEqual([
      { firstName: 'Paulo', lastName: 'Garcia', email: 'paolo@example.ph', role: 'Manager', version: VERSION },
    ]);
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Paulo', role: 'Manager', version: NEXT_VERSION }),
    );
  });

  it('shows Saving while the request runs and sends one request', async () => {
    const user = userEvent.setup();
    const seen = backend(detail(), {
      put: () => undefined,
    });
    server.use(
      http.put('*/api/v1/users/:id', async () => {
        seen.puts.push('slow');
        await delay(80);
        return HttpResponse.json(detail());
      }),
    );
    renderPanel();
    await screen.findByDisplayValue('Paolo');

    await user.click(saveButton());
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Saving' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });
    expect(seen.puts).toHaveLength(1);
  });

  it('puts a taken address from the server under Email with the cursor there', async () => {
    const user = userEvent.setup();
    backend(detail(), {
      put: () => problem(400, { errors: { email: ['Another account already uses this email.'] } }),
    });
    renderPanel();
    await screen.findByDisplayValue('Paolo');
    await replaceEmail(user, 'taken@example.ph');

    await user.click(saveButton());

    expect(await screen.findByText('Another account already uses this email.')).toBeInTheDocument();
    expect(email()).toHaveFocus();
    expect(email()).toHaveValue('taken@example.ph');
  });
});

describe('U3 how a changed email applies (D-45)', () => {
  const choice = () => screen.queryByRole('group', { name: 'How this email change applies' });

  it('shows no choice while the email matches the saved one', async () => {
    await openLoaded();

    expect(choice()).toBeNull();
  });

  it('shows no choice for the same address in another letter case', async () => {
    const user = userEvent.setup();
    await openLoaded();

    await replaceEmail(user, 'PAOLO@Example.ph');

    expect(choice()).toBeNull();
  });

  it('shows the two rows once a person with a password gets a different email, "Confirm by link" preselected', async () => {
    const user = userEvent.setup();
    await openLoaded();

    await replaceEmail(user, 'paolo.g@example.ph');

    const group = screen.getByRole('group', { name: 'How this email change applies' });
    expect(within(group).getByRole('radio', { name: 'Confirm by link' })).toBeChecked();
    expect(
      within(group).getByText('The new address must confirm first, and the old address is told.'),
    ).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Save at once' })).not.toBeChecked();
    expect(
      within(group).getByText('The email changes now. The old address is told and they are signed out everywhere.'),
    ).toBeInTheDocument();
  });

  it('sends emailChange "confirm" by default for a changed email', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');

    await user.click(saveButton());

    await waitFor(() => {
      expect(seen.puts).toHaveLength(1);
    });
    expect(seen.puts[0]).toEqual({
      firstName: 'Paolo',
      lastName: 'Garcia',
      email: 'paolo.g@example.ph',
      role: 'Admin',
      version: VERSION,
      emailChange: 'confirm',
    });
  });

  it('sends emailChange "now" when the Manager picks "Save at once"', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');
    await user.click(screen.getByRole('radio', { name: 'Save at once' }));

    await user.click(saveButton());

    await waitFor(() => {
      expect(seen.puts).toHaveLength(1);
    });
    expect(seen.puts[0]).toMatchObject({ email: 'paolo.g@example.ph', emailChange: 'now' });
  });

  it('sends no emailChange when the email is unchanged', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await user.clear(lastName());
    await user.type(lastName(), 'Garza');

    await user.click(saveButton());

    await waitFor(() => {
      expect(seen.puts).toHaveLength(1);
    });
    expect(seen.puts[0]).not.toHaveProperty('emailChange');
  });

  it('hides the choice and drops it from the request when the email is typed back, and starts at "Confirm by link" again', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');
    await user.click(screen.getByRole('radio', { name: 'Save at once' }));

    await replaceEmail(user, 'paolo@example.ph');
    expect(choice()).toBeNull();
    await replaceEmail(user, 'paolo.h@example.ph');

    expect(screen.getByRole('radio', { name: 'Confirm by link' })).toBeChecked();
    await replaceEmail(user, 'paolo@example.ph');
    await user.click(saveButton());
    await waitFor(() => {
      expect(seen.puts).toHaveLength(1);
    });
    expect(seen.puts[0]).not.toHaveProperty('emailChange');
  });

  it('shows no choice for an invited person with no password, and sends emailChange "confirm"', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded(detail({ hasPassword: false, inviteState: 'pending' }));

    await replaceEmail(user, 'paolo.g@example.ph');

    expect(choice()).toBeNull();
    await user.click(saveButton());
    await waitFor(() => {
      expect(seen.puts).toHaveLength(1);
    });
    expect(seen.puts[0]).toMatchObject({ email: 'paolo.g@example.ph', emailChange: 'confirm' });
  });

  it('shows a server message under emailChange next to the choice', async () => {
    const user = userEvent.setup();
    backend(detail(), {
      put: () => problem(400, { errors: { emailChange: ['Choose how the email change applies.'] } }),
    });
    renderPanel();
    await screen.findByDisplayValue('Paolo');
    await replaceEmail(user, 'paolo.g@example.ph');

    await user.click(saveButton());

    const message = await screen.findByText('Choose how the email change applies.');
    expect(message).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'How this email change applies' })).toBeInTheDocument();
  });

  it('has no axe violations with the choice showing', async () => {
    const user = userEvent.setup();
    await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');

    await expectNoAxeViolations(document.body);
  });
});
