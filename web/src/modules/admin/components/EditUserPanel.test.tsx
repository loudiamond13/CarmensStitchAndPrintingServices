import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
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
      'plain',
    );
  });

  it('shows Saving while the request runs and sends one request', async () => {
    const user = userEvent.setup();
    const seen = backend(detail(), {
      put: () => undefined,
    });
    // The request waits for the test to let it go, so a slow machine cannot finish it before the Saving label is looked for.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put('*/api/v1/users/:id', async () => {
        seen.puts.push('slow');
        await gate;
        return HttpResponse.json(detail());
      }),
    );
    renderPanel();
    await screen.findByDisplayValue('Paolo');

    await user.click(saveButton());
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Saving' })).toBeInTheDocument();
    release();
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

// --- Account access (USER-03, USER-07, D-16, D-21; plan 05-30) ---

interface AccessCall {
  method: string;
  /** The path after /users/{id}/. */
  path: string;
  key: string | null;
  body: unknown;
}

interface Access {
  calls: AccessCall[];
  gets: number;
  /** The person as the server now holds them. */
  current: UserDetailResponse;
}

/** Answers GET /users/{id} and the account routes; each action changes the person the way the server does. */
function accessBackend(
  loaded: UserDetailResponse = detail(),
  answers: Readonly<Record<string, () => Response>> = {},
): Access {
  const access: Access = { calls: [], gets: 0, current: loaded };
  server.use(
    http.get('*/api/v1/users/:id', () => {
      access.gets += 1;
      return HttpResponse.json(access.current);
    }),
    http.post('*/api/v1/users/:id/:action', async ({ request, params }) => {
      const action = String(params.action);
      const text = await request.text();
      access.calls.push({
        method: 'POST',
        path: action,
        key: request.headers.get('Idempotency-Key'),
        body: text === '' ? null : (JSON.parse(text) as unknown),
      });
      const custom = answers[action];
      if (custom !== undefined) {
        return custom();
      }
      if (action === 'lock') {
        access.current = { ...access.current, managerLocked: true, status: 'locked', version: NEXT_VERSION };
      } else if (action === 'unlock') {
        access.current = { ...access.current, managerLocked: false, status: 'active', version: NEXT_VERSION };
      } else if (action === 'temporary-password') {
        access.current = { ...access.current, version: NEXT_VERSION };
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('*/api/v1/users/:id/email-change', ({ request }) => {
      access.calls.push({
        method: 'DELETE',
        path: 'email-change',
        key: request.headers.get('Idempotency-Key'),
        body: null,
      });
      access.current = { ...access.current, pendingEmail: null };
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return access;
}

function renderAccessPanel(handlers: { onClose?: () => void; onSaved?: (saved: unknown) => void } = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  const onAccountChanged = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <EditUserPanel userId={ID} onClose={onClose} onSaved={onSaved} onAccountChanged={onAccountChanged} />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose, onSaved, onAccountChanged };
}

/** Opens the panel with the account routes answering, and waits until the person is loaded into the form. */
async function openAccess(
  loaded: UserDetailResponse = detail(),
  answers: Readonly<Record<string, () => Response>> = {},
) {
  const access = accessBackend(loaded, answers);
  const handlers = renderAccessPanel();
  await waitFor(() => {
    expect(firstName()).toHaveValue(loaded.firstName);
  });
  return { access, ...handlers };
}

const accessHeading = () => screen.queryByRole('heading', { level: 3, name: 'Account access' });
const accessButton = (name: string) => screen.queryByRole('button', { name });
const ACCESS_BUTTONS = ['Resend Invitation', 'Send Reset Link', 'Set Temporary Password', 'Lock', 'Unlock'] as const;

function visibleAccessButtons(): string[] {
  return ACCESS_BUTTONS.filter((name) => accessButton(name) !== null);
}

/** Confirms the open Lock dialog. */
async function confirmLock(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Lock Paolo Garcia?' });
  await user.click(within(dialog).getByRole('button', { name: 'Lock User' }));
}

describe('U3 Account access: what shows (USER-07, D-16, D-18)', () => {
  it('shows Send Reset Link, Set Temporary Password and Lock for an active person with a password', async () => {
    await openAccess();

    expect(accessHeading()).toBeInTheDocument();
    expect(visibleAccessButtons()).toEqual(['Send Reset Link', 'Set Temporary Password', 'Lock']);
  });

  it('shows Resend Invitation, Set Temporary Password and Lock for an invited person with no password yet', async () => {
    await openAccess(detail({ hasPassword: false, inviteState: 'pending' }));

    expect(visibleAccessButtons()).toEqual(['Resend Invitation', 'Set Temporary Password', 'Lock']);
  });

  it('shows Resend Invitation for an invitation that expired', async () => {
    await openAccess(detail({ hasPassword: false, inviteState: 'expired' }));

    expect(visibleAccessButtons()).toEqual(['Resend Invitation', 'Set Temporary Password', 'Lock']);
  });

  it('shows only Unlock for a person a Manager locked', async () => {
    await openAccess(detail({ status: 'locked', managerLocked: true }));

    expect(visibleAccessButtons()).toEqual(['Unlock']);
  });

  it('shows no Unlock for the failed-password lockout, only the heading', async () => {
    await openAccess(detail({ status: 'locked', managerLocked: false }));

    expect(accessHeading()).toBeInTheDocument();
    expect(visibleAccessButtons()).toEqual([]);
  });

  it('shows only the heading for a deactivated person', async () => {
    await openAccess(detail({ status: 'inactive' }));

    expect(accessHeading()).toBeInTheDocument();
    expect(visibleAccessButtons()).toEqual([]);
  });

  it('puts the section after the form fields, with an icon on each button', async () => {
    await openAccess();

    expect(screen.getByRole('button', { name: 'Lock' }).querySelector('svg')).not.toBeNull();
    const heading = screen.getByRole('heading', { level: 3, name: 'Account access' });
    expect(email().compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no axe violations with the section showing', async () => {
    await openAccess();

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 Account access while the form is edited (D-21, T-05-88)', () => {
  it('aria-disables every button with the hint "Save or discard your changes first." and sends nothing', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess();
    expect(screen.queryByText('Save or discard your changes first.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lock' })).not.toHaveAttribute('aria-disabled');

    await user.type(firstName(), 'o');

    expect(screen.getByText('Save or discard your changes first.')).toBeInTheDocument();
    for (const name of ['Send Reset Link', 'Set Temporary Password', 'Lock']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await user.click(screen.getByRole('button', { name: 'Set Temporary Password' }));
    expect(screen.queryByRole('dialog', { name: 'Lock Paolo Garcia?' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Set a temporary password' })).toBeNull();
    expect(access.calls).toEqual([]);
  });

  it('keeps the buttons focusable and points them at the hint', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.type(firstName(), 'o');

    const lock = screen.getByRole('button', { name: 'Lock' });
    const hint = screen.getByText('Save or discard your changes first.');
    expect(lock).not.toBeDisabled();
    expect(lock.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('enables them again once the typed change is undone', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.type(firstName(), 'o');
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute('aria-disabled', 'true');

    await user.type(firstName(), '{Backspace}');

    expect(screen.getByRole('button', { name: 'Lock' })).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText('Save or discard your changes first.')).toBeNull();
  });

  it('has no axe violations while the buttons are aria-disabled', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.type(firstName(), 'o');

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 Lock and Unlock (USER-03, D-16, U4)', () => {
  it('opens the Lock confirm with "Keep Unlocked" focused and sends nothing until it is confirmed', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess();

    await user.click(screen.getByRole('button', { name: 'Lock' }));

    const dialog = screen.getByRole('dialog', { name: 'Lock Paolo Garcia?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Unlocked' })).toHaveFocus();
    expect(access.calls).toEqual([]);
  });

  it('Esc closes only the confirm, and the panel stays open with focus back on Lock', async () => {
    const user = userEvent.setup();
    const { access, onClose } = await openAccess();
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Lock Paolo Garcia?' })).toBeNull();
    });
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(access.calls).toEqual([]);
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveFocus();
  });

  it('locks at once with an Idempotency-Key and no body, reloads the person, toasts, and focuses Unlock', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged, onSaved } = await openAccess();
    const getsBefore = access.gets;
    await user.click(screen.getByRole('button', { name: 'Lock' }));

    await confirmLock(user);

    const unlock = await screen.findByRole('button', { name: 'Unlock' });
    await waitFor(() => {
      expect(unlock).toHaveFocus();
    });
    expect(access.calls).toEqual([{ method: 'POST', path: 'lock', key: expect.any(String) as unknown, body: null }]);
    expect(access.gets).toBeGreaterThan(getsBefore);
    expect(visibleAccessButtons()).toEqual(['Unlock']);
    expect(screen.getByText('User locked')).toBeInTheDocument();
    expect(screen.getByText("Paolo Garcia is signed out and can't sign in until you unlock them.")).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Lock Paolo Garcia?' })).toBeNull();
    expect(onAccountChanged).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('keeps the confirm open with the guard line when the server refuses, and reloads nothing', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess(detail(), {
      lock: () => problem(422, { code: 'users.last-active-manager' }),
    });
    const getsBefore = access.gets;
    await user.click(screen.getByRole('button', { name: 'Lock' }));

    await confirmLock(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("You can't remove the last active Manager.");
    expect(screen.getByRole('dialog', { name: 'Lock Paolo Garcia?' })).toBeInTheDocument();
    expect(access.gets).toBe(getsBefore);
    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it('unlocks at once with no confirm, reloads the person, and toasts', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess(detail({ status: 'locked', managerLocked: true }));
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('User unlocked')).toBeInTheDocument();
    expect(screen.getByText('Paolo Garcia can sign in again.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /^Lock/ })).toBeNull();
    expect(access.calls).toEqual([{ method: 'POST', path: 'unlock', key: expect.any(String) as unknown, body: null }]);
    await waitFor(() => {
      expect(visibleAccessButtons()).toEqual(['Send Reset Link', 'Set Temporary Password', 'Lock']);
    });
    expect(access.gets).toBeGreaterThan(getsBefore);
    expect(onAccountChanged).toHaveBeenCalledTimes(1);
  });

  it('raises a danger toast that stays, with the mapper line, when Unlock fails', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess(detail({ status: 'locked', managerLocked: true }), {
      unlock: () => problem(500),
    });
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText("Couldn't unlock Paolo Garcia")).toBeInTheDocument();
    expect(screen.getByText('Please try again.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
    expect(access.gets).toBe(getsBefore);
    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it('can lock again after an unlock (a finished action is not replayed)', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess();
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await confirmLock(user);
    await user.click(await screen.findByRole('button', { name: 'Unlock' }));
    await user.click(await screen.findByRole('button', { name: 'Lock' }));
    await confirmLock(user);

    await screen.findByRole('button', { name: 'Unlock' });
    expect(access.calls.map((call) => call.path)).toEqual(['lock', 'unlock', 'lock']);
    expect(new Set(access.calls.map((call) => call.key)).size).toBe(3);
  });

  it('has no axe violations with the Lock confirm stacked over the panel', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.click(screen.getByRole('button', { name: 'Lock' }));

    await expectNoAxeViolations(document.body);
  });
});

describe('U3 Resend Invitation and Send Reset Link (USER-07, D-13)', () => {
  const INVITED = () => detail({ hasPassword: false, inviteState: 'pending' });

  it('resends the invitation at once with an Idempotency-Key, reloads the person, and toasts the 7 days', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess(INVITED());
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Resend Invitation' }));

    expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
    expect(
      screen.getByText('We emailed Paolo a new link. It works for 7 days, and the old link no longer works.'),
    ).toBeInTheDocument();
    expect(access.calls).toEqual([
      { method: 'POST', path: 'resend-invitation', key: expect.any(String) as unknown, body: null },
    ]);
    await waitFor(() => {
      expect(access.gets).toBeGreaterThan(getsBefore);
    });
    await waitFor(() => {
      expect(onAccountChanged).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog', { name: /^Lock/ })).toBeNull();
  });

  it('sends the reset link at once, reloads the person, and toasts the 30 minutes', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess();
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText('Reset link sent')).toBeInTheDocument();
    expect(
      screen.getByText('We emailed Paolo a link to set a new password. It works for 30 minutes.'),
    ).toBeInTheDocument();
    expect(access.calls).toEqual([
      { method: 'POST', path: 'send-reset-link', key: expect.any(String) as unknown, body: null },
    ]);
    await waitFor(() => {
      expect(access.gets).toBeGreaterThan(getsBefore);
    });
    await waitFor(() => {
      expect(onAccountChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('can send another reset link after the first (a finished action is not replayed)', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess();

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await waitFor(() => {
      expect(access.gets).toBeGreaterThan(1);
    });
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(access.calls).toHaveLength(2);
    });
    expect(new Set(access.calls.map((call) => call.key)).size).toBe(2);
  });

  it.each([
    [
      'Resend Invitation',
      'resend-invitation',
      422,
      'users.already-set-up',
      'They already have a password. Send a reset link instead.',
    ],
    [
      'Send Reset Link',
      'send-reset-link',
      429,
      'users.reset-link-capped',
      'Too many reset links for this person. Wait an hour, then try again.',
    ],
    [
      'Send Reset Link',
      'send-reset-link',
      422,
      'users.blocked',
      'This account is locked or deactivated. Unlock or activate this person first.',
    ],
    [
      'Send Reset Link',
      'send-reset-link',
      422,
      'users.no-password',
      "They haven't set a password yet. Resend the invitation instead.",
    ],
  ])(
    '%s via /%s: a %i %s raises a danger toast that stays, with the mapper line',
    async (button, path, status, code, line) => {
      const user = userEvent.setup();
      const { access, onAccountChanged } = await openAccess(button === 'Resend Invitation' ? INVITED() : detail(), {
        [path]: () => problem(status, { code }),
      });
      const getsBefore = access.gets;

      await user.click(screen.getByRole('button', { name: button }));

      expect(await screen.findByText("Couldn't send the email")).toBeInTheDocument();
      expect(screen.getByText(line)).toBeInTheDocument();
      expect(access.gets).toBe(getsBefore);
      expect(onAccountChanged).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: button })).toBeInTheDocument();
    },
  );

  it('says so when the person was deleted meanwhile (404)', async () => {
    const user = userEvent.setup();
    await openAccess(detail(), { 'send-reset-link': () => problem(404, { code: 'users.not-found' }) });

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText("Couldn't send the email")).toBeInTheDocument();
    expect(screen.getAllByText('This user was deleted.').length).toBeGreaterThan(0);
  });
});

/** A readable sample the tests type into the dialog. */
const TYPED = ['Tela', 'Sukat', '7381'].join('-');

describe('U3 Set Temporary Password (USER-07, C-4, D-14, U5)', () => {
  const field = () => screen.getByLabelText<HTMLInputElement>('Temporary password', { exact: true });
  const setButton = () => screen.getByRole('button', { name: /^(Set Password|Setting)$/ });
  const trigger = () => screen.getByRole('button', { name: 'Set Temporary Password' });

  it('opens the set step stacked over the panel, with the cursor in the prefilled password', async () => {
    const user = userEvent.setup();
    await openAccess();

    await user.click(trigger());

    const dialog = screen.getByRole('dialog', { name: 'Set a temporary password' });
    expect(within(dialog).getByText('For Paolo Garcia')).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(field().value).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  });

  it('keeps focus inside the dialog while it is stacked over the panel', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.click(trigger());
    const dialog = screen.getByRole('dialog', { name: 'Set a temporary password' });

    for (let press = 0; press < 12; press += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('Esc closes only the dialog: the panel stays open and focus returns to Set Temporary Password', async () => {
    const user = userEvent.setup();
    const { access, onClose } = await openAccess();
    await user.click(trigger());
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Set a temporary password' })).toBeNull();
    });
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(trigger()).toHaveFocus();
    expect(access.calls).toEqual([]);
  });

  it('sets the password with the body and a key, shows it once, and reloads U3 only when Done closes it', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess();
    const getsBefore = access.gets;
    await user.click(trigger());
    await user.clear(field());
    await user.type(field(), TYPED);

    await user.click(setButton());

    const shown = await screen.findByRole('dialog', { name: 'Temporary password set' });
    expect(within(shown).getByLabelText('Temporary password for Paolo')).toHaveValue(TYPED);
    expect(access.calls).toEqual([
      {
        method: 'POST',
        path: 'temporary-password',
        key: expect.any(String) as unknown,
        body: { temporaryPassword: TYPED },
      },
    ]);
    expect(access.gets).toBe(getsBefore);
    expect(onAccountChanged).not.toHaveBeenCalled();

    await user.click(within(shown).getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Temporary password set' })).toBeNull();
    });
    expect(trigger()).toHaveFocus();
    await waitFor(() => {
      expect(access.gets).toBeGreaterThan(getsBefore);
    });
    await waitFor(() => {
      expect(onAccountChanged).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.body.innerHTML).not.toContain(TYPED);
    });
  });

  it('reloads nothing when the dialog is cancelled without setting a password', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess();
    const getsBefore = access.gets;
    await user.click(trigger());

    const dialog = screen.getByRole('dialog', { name: 'Set a temporary password' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Set a temporary password' })).toBeNull();
    });
    expect(access.gets).toBe(getsBefore);
    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it('opens again with a fresh suggestion and nothing of the earlier password', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.click(trigger());
    const first = field().value;
    await user.click(setButton());
    const shown = await screen.findByRole('dialog', { name: 'Temporary password set' });
    await user.click(within(shown).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Temporary password set' })).toBeNull();
    });

    await user.click(trigger());

    expect(await screen.findByRole('dialog', { name: 'Set a temporary password' })).toBeInTheDocument();
    expect(field().value).not.toBe(first);
    expect(document.body.innerHTML).not.toContain(first);
  });

  it('keeps the dialog open with the guard line when the server refuses', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess(detail(), {
      'temporary-password': () => problem(422, { code: 'users.blocked' }),
    });
    const getsBefore = access.gets;
    await user.click(trigger());

    await user.click(setButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is locked or deactivated. Unlock or activate this person first.',
    );
    expect(screen.getByRole('dialog', { name: 'Set a temporary password' })).toBeInTheDocument();
    expect(access.gets).toBe(getsBefore);
  });

  it('has no axe violations with the dialog stacked over the panel', async () => {
    const user = userEvent.setup();
    await openAccess();
    await user.click(trigger());

    await expectNoAxeViolations(document.body);
  });
});

// --- Email notes, the pending change and the save outcome (C-9, OQ-4, D-45; plan 05-30) ---

const INVITED_NOTE = "We'll send the invitation to the new address instead. The old link stops working.";
const CONFIRM_NOTE = "We'll email a confirmation link to the new address. The change applies when they open it.";
const NOW_NOTE =
  'The email changes as soon as you save. The old address gets a notice and Paolo is signed out on every device.';

describe('U3 email notes (C-9, OQ-4, D-45)', () => {
  it('shows no note while the email matches the saved one', async () => {
    await openLoaded();

    expect(screen.queryByText(CONFIRM_NOTE)).toBeNull();
    expect(screen.queryByText(NOW_NOTE)).toBeNull();
    expect(screen.queryByText(INVITED_NOTE)).toBeNull();
  });

  it('tells an invited person the invitation goes to the new address, with no choice shown', async () => {
    const user = userEvent.setup();
    await openLoaded(detail({ hasPassword: false, inviteState: 'pending' }));

    await replaceEmail(user, 'paolo.g@example.ph');

    expect(screen.getByText(INVITED_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'How this email change applies' })).toBeNull();
    expect(screen.queryByText(CONFIRM_NOTE)).toBeNull();
    await replaceEmail(user, 'paolo@example.ph');
    expect(screen.queryByText(INVITED_NOTE)).toBeNull();
  });

  it('tells a person with a password a confirmation link goes to the new address while "Confirm by link" is chosen', async () => {
    const user = userEvent.setup();
    await openLoaded();

    await replaceEmail(user, 'paolo.g@example.ph');

    expect(screen.getByText(CONFIRM_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(INVITED_NOTE)).toBeNull();
    expect(screen.queryByText(NOW_NOTE)).toBeNull();
  });

  it('follows the radio choice live: "Save at once" says the email changes now, and back to the link again', async () => {
    const user = userEvent.setup();
    await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');

    await user.click(screen.getByRole('radio', { name: 'Save at once' }));
    expect(screen.getByText(NOW_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM_NOTE)).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Confirm by link' }));
    expect(screen.getByText(CONFIRM_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(NOW_NOTE)).toBeNull();
  });

  it('drops the note when the email is typed back to the saved one', async () => {
    const user = userEvent.setup();
    await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');
    await user.click(screen.getByRole('radio', { name: 'Save at once' }));

    await replaceEmail(user, 'paolo@example.ph');

    expect(screen.queryByText(NOW_NOTE)).toBeNull();
    expect(screen.queryByText(CONFIRM_NOTE)).toBeNull();
  });

  it('has no axe violations with each note showing', async () => {
    const user = userEvent.setup();
    await openLoaded();
    await replaceEmail(user, 'paolo.g@example.ph');
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('radio', { name: 'Save at once' }));
    await expectNoAxeViolations(document.body);
  });
});

describe('U3 how a save treats the email (D-45, the save toast)', () => {
  it("reports 'pending' when the link was sent to the new address", async () => {
    const user = userEvent.setup();
    const { onSaved } = await openLoaded(detail(), {
      put: () => HttpResponse.json(detail({ pendingEmail: 'paolo.g@example.ph', version: NEXT_VERSION })),
    });
    await replaceEmail(user, 'paolo.g@example.ph');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ pendingEmail: 'paolo.g@example.ph' }), 'pending');
  });

  it('reports \'moved\' when a person with a password was saved with "Save at once"', async () => {
    const user = userEvent.setup();
    const { onSaved } = await openLoaded(detail(), {
      put: () => HttpResponse.json(detail({ email: 'paolo.g@example.ph', version: NEXT_VERSION })),
    });
    await replaceEmail(user, 'paolo.g@example.ph');
    await user.click(screen.getByRole('radio', { name: 'Save at once' }));

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ email: 'paolo.g@example.ph' }), 'moved');
  });

  it("reports 'plain' for an invited person whose address moved, and for a save that left the email alone", async () => {
    const user = userEvent.setup();
    const invited = await openLoaded(detail({ hasPassword: false, inviteState: 'pending' }), {
      put: () => HttpResponse.json(detail({ hasPassword: false, email: 'paolo.g@example.ph', version: NEXT_VERSION })),
    });
    await replaceEmail(user, 'paolo.g@example.ph');
    await user.click(saveButton());
    await waitFor(() => {
      expect(invited.onSaved).toHaveBeenCalledTimes(1);
    });
    expect(invited.onSaved).toHaveBeenCalledWith(expect.anything(), 'plain');
  });

  it("reports 'plain' when only the name changed", async () => {
    const user = userEvent.setup();
    const { onSaved } = await openLoaded();
    await user.clear(firstName());
    await user.type(firstName(), 'Paulo');

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Paulo' }), 'plain');
  });
});

describe('U3 a pending email change (C-9)', () => {
  const PENDING = 'paolo.g@example.ph';
  const pendingNote = () => screen.queryByText('Waiting for confirmation at', { exact: false });

  it('shows no pending note when nothing waits', async () => {
    await openAccess();

    expect(pendingNote()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel Email Change' })).toBeNull();
  });

  it('shows "Waiting for confirmation at {new email}." with the address in bold and a Cancel Email Change button', async () => {
    await openAccess(detail({ pendingEmail: PENDING }));

    expect(pendingNote()).toHaveTextContent(`Waiting for confirmation at ${PENDING}.`);
    expect(screen.getByText(PENDING).tagName).toBe('STRONG');
    expect(screen.getByRole('button', { name: 'Cancel Email Change' })).toBeInTheDocument();
  });

  it('calls it off with a DELETE and no key, reads the person again, toasts, and puts the cursor on Email', async () => {
    const user = userEvent.setup();
    const { access, onAccountChanged } = await openAccess(detail({ pendingEmail: PENDING }));
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Cancel Email Change' }));

    expect(await screen.findByText('Email change canceled')).toBeInTheDocument();
    expect(screen.getByText('Paolo keeps signing in with paolo@example.ph.')).toBeInTheDocument();
    expect(access.calls).toEqual([{ method: 'DELETE', path: 'email-change', key: null, body: null }]);
    await waitFor(() => {
      expect(pendingNote()).toBeNull();
    });
    expect(access.gets).toBeGreaterThan(getsBefore);
    expect(email()).toHaveFocus();
    expect(onAccountChanged).toHaveBeenCalledTimes(1);
  });

  it('raises a danger toast that stays, with the mapper line, when the cancel fails, and the note stays', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess(detail({ pendingEmail: PENDING }));
    server.use(http.delete('*/api/v1/users/:id/email-change', () => problem(500)));
    const getsBefore = access.gets;

    await user.click(screen.getByRole('button', { name: 'Cancel Email Change' }));

    expect(await screen.findByText("Couldn't cancel the email change")).toBeInTheDocument();
    expect(screen.getByText('Please try again.', { exact: false })).toBeInTheDocument();
    expect(pendingNote()).not.toBeNull();
    expect(access.gets).toBe(getsBefore);
  });

  it('waits like the Account access buttons while the form has unsaved changes', async () => {
    const user = userEvent.setup();
    const { access } = await openAccess(detail({ pendingEmail: PENDING }));
    await user.type(firstName(), 'o');

    const cancel = screen.getByRole('button', { name: 'Cancel Email Change' });
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    await user.click(cancel);

    expect(access.calls).toEqual([]);
  });

  it('has no axe violations with the pending note showing', async () => {
    await openAccess(detail({ pendingEmail: PENDING }));

    await expectNoAxeViolations(document.body);
  });
});
