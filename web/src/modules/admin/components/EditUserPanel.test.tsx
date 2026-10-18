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
  /** What the next GET answers: the person as someone else saved them meanwhile. */
  serve: (next: UserDetailResponse) => void;
  /** Makes the next GETs answer with this response (a failure), until `serve` puts a person back. */
  fail: (response: () => Response) => void;
}

/** Answers GET and PUT /users/{id}; the PUT echoes the body into the saved person with the next version. */
function backend(
  loaded: UserDetailResponse = detail(),
  options: { getDelay?: number; put?: (body: Record<string, unknown>) => Response | undefined } = {},
): Backend {
  let current = loaded;
  let failure: (() => Response) | null = null;
  const seen: Backend = {
    puts: [],
    gets: 0,
    serve: (next) => {
      current = next;
      failure = null;
    },
    fail: (response) => {
      failure = response;
    },
  };
  server.use(
    http.get('*/api/v1/users/:id', async () => {
      seen.gets += 1;
      if (options.getDelay !== undefined) {
        await delay(options.getDelay);
      }
      return failure === null ? HttpResponse.json(current) : failure();
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
async function openLoaded(loaded: UserDetailResponse = detail(), options: Parameters<typeof backend>[1] = {}) {
  const seen = backend(loaded, options);
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

const LATEST_VERSION = '2a2a2a2a-3333-4444-8555-666677778888';
const STALE = { code: 'edit.stale', detail: 'This was changed by someone else.' };

describe('U3 a stale save (D-20, SEC-07)', () => {
  /** Opens the panel, types a new first name and presses Save Changes against a server that answers 409. */
  async function staleSave() {
    const user = userEvent.setup();
    const opened = await openLoaded(detail(), { put: () => problem(409, STALE) });
    await user.clear(firstName());
    await user.type(firstName(), 'Paulo');
    await user.click(saveButton());
    await screen.findByText('This was changed by someone else.');
    return { user, ...opened };
  }

  it('keeps every typed value, shows the shared banner at the top and focuses Load Latest', async () => {
    await staleSave();

    expect(
      screen.getByText('Reload and try again. Your typed changes stay here until you press Load Latest.'),
    ).toBeInTheDocument();
    expect(firstName()).toHaveValue('Paulo');
    expect(lastName()).toHaveValue('Garcia');
    expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument();
  });

  it('Load Latest replaces the values and the version, removes the banner, focuses First name and announces it', async () => {
    const { user, seen } = await staleSave();
    seen.serve(detail({ firstName: 'Paola', lastName: 'Garza', role: 'Manager', version: LATEST_VERSION }));

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(firstName()).toHaveValue('Paola');
    });
    expect(lastName()).toHaveValue('Garza');
    expect(screen.getByRole('radio', { name: 'Manager' })).toBeChecked();
    expect(screen.queryByText('This was changed by someone else.')).toBeNull();
    expect(firstName()).toHaveFocus();
    expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();
  });

  it('saves with the latest version after Load Latest', async () => {
    const { user, seen } = await staleSave();
    seen.serve(detail({ firstName: 'Paola', version: LATEST_VERSION }));
    await user.click(screen.getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(firstName()).toHaveValue('Paola');
    });

    await user.click(saveButton());

    await waitFor(() => {
      expect(seen.puts).toHaveLength(2);
    });
    expect(seen.puts[1]).toMatchObject({ firstName: 'Paola', version: LATEST_VERSION });
  });

  it('replaces the typed values even when the latest version holds the same ones as the first load', async () => {
    const { user, seen } = await staleSave();
    seen.serve(detail({ version: LATEST_VERSION }));

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(firstName()).toHaveValue('Paolo');
    });
    expect(screen.queryByText('This was changed by someone else.')).toBeNull();
  });

  it('keeps the typed values and the banner when Load Latest itself fails, and says why', async () => {
    const { user, seen } = await staleSave();
    seen.fail(() => problem(500));

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(firstName()).toHaveValue('Paulo');
    expect(screen.getByText('This was changed by someone else.')).toBeInTheDocument();
  });

  it('shows the banner again, with focus on Load Latest, when the next save is stale too', async () => {
    const { user } = await staleSave();
    await user.click(screen.getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(screen.queryByText('This was changed by someone else.')).toBeNull();
    });

    await user.click(saveButton());

    expect(await screen.findByText('This was changed by someone else.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it('has no axe violations with the banner showing', async () => {
    await staleSave();

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 refusals keep what was typed (D-18, D-19)', () => {
  it('shows the last-Manager guard with both lines and keeps the values and a usable Save Changes', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded(detail({ role: 'Manager' }), {
      put: () => problem(422, { code: 'users.last-active-manager' }),
    });
    await user.click(screen.getByRole('radio', { name: 'Admin' }));
    await user.clear(lastName());
    await user.type(lastName(), 'Garza');

    await user.click(saveButton());

    expect(await screen.findByText("You can't remove the last active Manager.")).toBeInTheDocument();
    expect(screen.getByText('Make another user a Manager first, then try again.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Admin' })).toBeChecked();
    expect(lastName()).toHaveValue('Garza');
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(seen.puts).toHaveLength(1);
  });

  it('shows the own-account guard if the server reaches it', async () => {
    const user = userEvent.setup();
    await openLoaded(detail(), { put: () => problem(422, { code: 'users.own-account' }) });

    await user.click(saveButton());

    expect(await screen.findByText("You can't do this to your own account.")).toBeInTheDocument();
    expect(screen.getByText('Change your own details in My Profile.')).toBeInTheDocument();
  });

  it('removes the guard when the next save goes through', async () => {
    const user = userEvent.setup();
    let refuse = true;
    const { onSaved } = await openLoaded(detail({ role: 'Manager' }), {
      put: () => (refuse ? problem(422, { code: 'users.last-active-manager' }) : undefined),
    });
    await user.click(saveButton());
    await screen.findByText("You can't remove the last active Manager.");
    refuse = false;

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("You can't remove the last active Manager.")).toBeNull();
  });

  it('shows one alert line for any other failure and keeps the values', async () => {
    const user = userEvent.setup();
    await openLoaded(detail(), { put: () => problem(500) });
    await user.clear(firstName());
    await user.type(firstName(), 'Paulo');

    await user.click(saveButton());

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(firstName()).toHaveValue('Paulo');
  });

  it('has no axe violations with the guard showing', async () => {
    const user = userEvent.setup();
    await openLoaded(detail(), { put: () => problem(422, { code: 'users.last-active-manager' }) });
    await user.click(saveButton());
    await screen.findByText("You can't remove the last active Manager.");

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 a person deleted meanwhile (D-09)', () => {
  it('on save shows "This user was deleted." with the values kept and Save Changes disabled', async () => {
    const user = userEvent.setup();
    const { seen } = await openLoaded(detail(), { put: () => problem(404, { code: 'users.not-found' }) });
    await user.clear(firstName());
    await user.type(firstName(), 'Paulo');

    await user.click(saveButton());

    expect(await screen.findByText('This user was deleted.')).toBeInTheDocument();
    expect(screen.getByText('Close this and refresh the list.')).toBeInTheDocument();
    expect(firstName()).toHaveValue('Paulo');
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(saveButton());
    expect(seen.puts).toHaveLength(1);
  });

  it('Cancel still closes the panel', async () => {
    const user = userEvent.setup();
    const { onClose } = await openLoaded(detail(), { put: () => problem(404, { code: 'users.not-found' }) });
    await user.click(saveButton());
    await screen.findByText('This user was deleted.');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('when the person is already gone on open shows the same banner and no form', async () => {
    const seen = backend();
    seen.fail(() => problem(404, { code: 'users.not-found' }));
    renderPanel();

    expect(await screen.findByText('This user was deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^First name/ })).toBeNull();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('has no axe violations with the deleted banner showing', async () => {
    const seen = backend();
    seen.fail(() => problem(404, { code: 'users.not-found' }));
    renderPanel();
    await screen.findByText('This user was deleted.');

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 the detail cannot be loaded', () => {
  it('shows "Couldn\'t load user details." with Try Again, which loads the form when it works', async () => {
    const user = userEvent.setup();
    const seen = backend();
    seen.fail(() => problem(500));
    renderPanel();

    expect(await screen.findByText("Couldn't load user details.")).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^First name/ })).toBeNull();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    seen.serve(detail());
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByDisplayValue('Paolo')).toHaveFocus();
    expect(screen.queryByText("Couldn't load user details.")).toBeNull();
  });

  it('has no axe violations with the load error showing', async () => {
    const seen = backend();
    seen.fail(() => problem(500));
    renderPanel();
    await screen.findByText("Couldn't load user details.");

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 who recorded and last changed the person (SEC-08, D-11)', () => {
  it('shows Recorded by and Last changed by below the form, a deleted colleague still named', async () => {
    await openLoaded(
      detail({
        recordedBy: { id: 'a1', name: 'Carmen Reyes', formerStaff: false },
        lastChangedBy: { id: 'a2', name: 'Ana Cruz', formerStaff: true },
        // 07:42 UTC is 3:42 PM in Manila.
        createdAt: '2026-10-17T07:42:00Z',
        updatedAt: '2026-10-18T01:05:00Z',
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit User' });
    expect(within(dialog).getByText('Recorded by').nextElementSibling).toHaveTextContent(
      'Carmen Reyes · Oct 17, 2026, 3:42 PM',
    );
    expect(within(dialog).getByText('Last changed by').nextElementSibling).toHaveTextContent(
      'Ana Cruz (former staff) · Oct 18, 2026, 9:05 AM',
    );
  });

  it('reads System for a person made before actors were recorded and Not set for a person never changed', async () => {
    await openLoaded(detail({ recordedBy: null, lastChangedBy: null, updatedAt: null }));

    const dialog = screen.getByRole('dialog', { name: 'Edit User' });
    expect(within(dialog).getByText('Recorded by').nextElementSibling).toHaveTextContent(/^System · /);
    expect(within(dialog).getByText('Last changed by').nextElementSibling).toHaveTextContent('Not set');
  });

  it("links to the person's activity in the audit log", async () => {
    await openLoaded();

    const link = screen.getByRole('link', { name: "See this user's activity in the audit log" });
    expect(link).toHaveAttribute('href', `/admin/audit-log?target=${ID}&range=all`);
  });

  it('has no axe violations with the record meta and the link showing', async () => {
    await openLoaded(detail({ recordedBy: { id: 'a1', name: 'Carmen Reyes', formerStaff: false } }));

    await expectNoAxeViolations(document.body);
  });
});
