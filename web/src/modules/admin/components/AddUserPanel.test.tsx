import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { AddUserPanel } from '@/modules/admin/components/AddUserPanel';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// U2 Add User slide-over, the invitation route (USER-02, D-12, D-15, OR-3; plan 05-22).

const PROBLEM = { 'Content-Type': 'application/problem+json' };
const NEW_ID = '00000000-0000-4000-8000-0000000000aa';

interface Sent {
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers POST /users (default: 201 with the new id) and records what arrived. */
function answer(
  reply: () => Response | Promise<Response> = () => HttpResponse.json({ id: NEW_ID }, { status: 201 }),
): Sent {
  const sent: Sent = { bodies: [], keys: [] };
  server.use(
    http.post('*/api/v1/users', async ({ request }) => {
      sent.bodies.push(await request.json());
      sent.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return sent;
}

function problem(status: number, body: Record<string, unknown> = {}): Response {
  return HttpResponse.json({ title: 'x', status, ...body }, { status, headers: PROBLEM });
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPanel(handlers: { onClose?: () => void; onCreated?: (created: unknown) => void } = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onCreated = handlers.onCreated ?? vi.fn();
  render(<AddUserPanel onClose={onClose} onCreated={onCreated} />);
  return { onClose, onCreated };
}

const firstName = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^First name/ });
const lastName = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Last name/ });
const email = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Email/ });
const createButton = () => screen.getByRole('button', { name: /^(Create User|Creating)$/ });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(firstName(), 'Ana');
  await user.type(lastName(), 'Reyes');
  await user.type(email(), 'ana@example.ph');
}

describe('U2 the panel', () => {
  it('opens as the "Add User" slide-over with the invitation description and focus on First name', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    expect(within(dialog).getByText("We'll email them a link to set their own password.")).toBeInTheDocument();
    expect(firstName()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create User' })).toBeInTheDocument();
  });

  it('gives the names no autofill, and Email the email keyboard, no autocorrection and the sign-in hint', () => {
    renderPanel();

    expect(firstName()).toHaveAttribute('autocomplete', 'off');
    expect(lastName()).toHaveAttribute('autocomplete', 'off');
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('inputmode', 'email');
    expect(email()).toHaveAttribute('autocapitalize', 'none');
    expect(email()).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByText("They'll use this to sign in.")).toBeInTheDocument();
  });

  it('preselects Admin (D-15) and lets the role hint follow the selection', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole('radio', { name: 'Admin' })).toBeChecked();
    expect(screen.getByText('Admins manage orders and company expenses.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Manager' }));

    expect(screen.getByRole('radio', { name: 'Manager' })).toBeChecked();
    expect(
      screen.getByText('Managers can do everything Admins can, plus add, edit and remove users.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Admins manage orders and company expenses.')).toBeNull();
  });

  it('has no axe violations, also with field errors showing', async () => {
    const user = userEvent.setup();
    renderPanel();
    await expectNoAxeViolations(document.body);

    await user.click(createButton());
    await screen.findByText('Enter a first name.');

    await expectNoAxeViolations(document.body);
  });
});

describe('U2 checks before sending (OR-3)', () => {
  it('shows every required message at once, sends nothing, keeps Create User enabled and focuses First name', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(createButton());

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a last name.')).toBeInTheDocument();
    expect(screen.getByText('Enter their email.')).toBeInTheDocument();
    expect(firstName()).toHaveAttribute('aria-invalid', 'true');
    expect(firstName()).toHaveFocus();
    expect(createButton()).toBeEnabled();
    expect(sent.bodies).toHaveLength(0);
  });

  it('shows a field message when the person leaves the field empty', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(firstName());
    await user.tab();

    expect(await screen.findByText('Enter a first name.')).toBeInTheDocument();
  });

  it('refuses an address that is not shaped like an email, before any request', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderPanel();
    await user.type(firstName(), 'Ana');
    await user.type(lastName(), 'Reyes');
    await user.type(email(), 'ana-at-example');

    await user.click(createButton());

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(email()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it('refuses a name over 100 characters', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderPanel();
    await fill(user);
    await user.type(firstName(), 'a'.repeat(98));

    await user.click(createButton());

    expect(await screen.findByText('First name must be 100 characters or fewer.')).toBeInTheDocument();
    expect(sent.bodies).toHaveLength(0);
  });
});

describe('U2 creating by invitation', () => {
  it('posts the trimmed values with one Idempotency-Key, then reports who was added and closes', async () => {
    const sent = answer();
    const user = userEvent.setup();
    const { onCreated, onClose } = renderPanel();
    await user.type(firstName(), ' Ana ');
    await user.type(lastName(), 'Reyes');
    await user.type(email(), 'ana@example.ph');

    await user.click(createButton());

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(sent.bodies).toEqual([
      { firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.ph', role: 'Admin', access: 'invitation' },
    ]);
    expect(sent.keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(onCreated).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Reyes',
      role: 'Admin',
      access: 'invitation',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends the Manager role when it was chosen', async () => {
    const sent = answer();
    const user = userEvent.setup();
    const { onCreated } = renderPanel();
    await fill(user);
    await user.click(screen.getByRole('radio', { name: 'Manager' }));

    await user.click(createButton());

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
    expect(sent.bodies[0]).toMatchObject({ role: 'Manager' });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ role: 'Manager' }));
  });

  it('shows "Creating" and ignores Esc, the scrim, Cancel and a second press while the request runs', async () => {
    const gate = deferred();
    const sent = answer(async () => {
      await gate.promise;
      return HttpResponse.json({ id: NEW_ID }, { status: 201 });
    });
    const user = userEvent.setup();
    const { onClose, onCreated } = renderPanel();
    await fill(user);

    await user.click(createButton());
    await screen.findByRole('button', { name: 'Creating' });
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const scrim = screen.getByRole('dialog').parentElement;
    if (scrim === null) {
      throw new Error('The panel has no scrim around it.');
    }
    await user.click(scrim);
    await user.click(screen.getByRole('button', { name: 'Creating' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(sent.bodies).toHaveLength(1);

    gate.resolve();
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });
});

describe('U2 server answers', () => {
  it('shows a taken address under Email with the cursor there, and keeps the panel and the typed values', async () => {
    answer(() => problem(400, { errors: { email: ['Another account already uses this email.'] } }));
    const user = userEvent.setup();
    const { onCreated, onClose } = renderPanel();
    await fill(user);

    await user.click(createButton());

    expect(await screen.findByText('Another account already uses this email.')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveFocus();
    expect(email()).toHaveValue('ana@example.ph');
    expect(firstName()).toHaveValue('Ana');
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows one alert line above the fields for a failure that belongs to no field, and keeps the values', async () => {
    answer(() => problem(500));
    const user = userEvent.setup();
    const { onCreated } = renderPanel();
    await fill(user);

    await user.click(createButton());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(firstName()).toHaveValue('Ana');
    expect(onCreated).not.toHaveBeenCalled();
    expect(createButton()).toBeEnabled();
  });

  it('retries a failed press with the same Idempotency-Key', async () => {
    let fail = true;
    const sent = answer(() => (fail ? problem(500) : HttpResponse.json({ id: NEW_ID }, { status: 201 })));
    const user = userEvent.setup();
    const { onCreated } = renderPanel();
    await fill(user);
    await user.click(createButton());
    await screen.findByRole('alert');

    fail = false;
    await user.click(createButton());

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });
});

describe('U2 closing', () => {
  it('closes with Cancel, Close, Esc and the scrim when nothing is pending', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    const scrim = screen.getByRole('dialog').parentElement;
    if (scrim === null) {
      throw new Error('The panel has no scrim around it.');
    }
    await user.click(scrim);

    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('starts clean on every open: typed values and messages from the last open are gone', async () => {
    const user = userEvent.setup();
    const handlers = { onClose: vi.fn(), onCreated: vi.fn() };
    const view = render(<AddUserPanel open {...handlers} />);
    await user.type(firstName(), 'Ana');
    await user.click(createButton());
    await screen.findByText('Enter a last name.');

    view.rerender(<AddUserPanel open={false} {...handlers} />);
    view.rerender(<AddUserPanel open {...handlers} />);

    expect(firstName()).toHaveValue('');
    expect(screen.queryByText('Enter a last name.')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Admin' })).toBeChecked();
  });
});

// The access choice, the temporary password and the shown-once step (C-4, D-12, D-14, OQ-10).

const TEMPORARY_FORM = /^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/;
const SHOWN_ONCE_NOTE =
  "This is the only time you'll see this password. Copy it now and give it to Ana in person or by private message. If it gets lost, set a new one.";

const accessGroup = () => screen.getByRole('group', { name: 'How they get access' });
const temporaryBox = () => screen.getByLabelText<HTMLInputElement>('Temporary password');
const copyBox = () => screen.getByLabelText<HTMLInputElement>('Temporary password for Ana');

type User = ReturnType<typeof userEvent.setup>;

/** Every key and value a Storage holds, as one text. */
function storedText(storage: Storage): string {
  return Object.keys(storage)
    .map((key) => `${key}=${storage.getItem(key) ?? ''}`)
    .join(' ');
}

async function chooseTemporary(user: User) {
  await user.click(screen.getByRole('radio', { name: 'Set a temporary password' }));
}

/** Fills the three fields, chooses the temporary route and presses Create User; resolves with the shown password. */
async function createWithTemporary(user: User): Promise<string> {
  await fill(user);
  await chooseTemporary(user);
  const password = temporaryBox().value;
  await user.click(createButton());
  await screen.findByLabelText('Temporary password for Ana');
  return password;
}

describe('U2 the access choice', () => {
  it('is a radio group of two rows with "Email an invitation" selected, each with its one-line description', () => {
    renderPanel();

    expect(accessGroup().tagName).toBe('FIELDSET');
    expect(within(accessGroup()).getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
    expect(within(accessGroup()).getByRole('radio', { name: 'Set a temporary password' })).not.toBeChecked();
    expect(
      within(accessGroup()).getByText('We email them a link to set their own password. It works for 7 days.'),
    ).toBeInTheDocument();
    expect(
      within(accessGroup()).getByText('You give them a password to use once. They choose their own at first sign-in.'),
    ).toBeInTheDocument();
  });

  it('shows no password field until the temporary route is chosen', () => {
    renderPanel();

    expect(screen.queryByLabelText('Temporary password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New Suggestion' })).toBeNull();
  });

  it('follows the choice in the panel description', async () => {
    const user = userEvent.setup();
    renderPanel();

    await chooseTemporary(user);

    expect(screen.getByText('They can sign in right away with a temporary password.')).toBeInTheDocument();
    expect(screen.queryByText("We'll email them a link to set their own password.")).toBeNull();
  });

  it('shows the Temporary password field prefilled with a Word-Word-NNNN value, with its hint and the meter', async () => {
    const user = userEvent.setup();
    renderPanel();

    await chooseTemporary(user);

    expect(temporaryBox().value).toMatch(TEMPORARY_FORM);
    expect(temporaryBox()).toHaveAttribute('type', 'password');
    expect(screen.getByText("Share it privately. They'll be asked to change it on first sign-in.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Suggestion' })).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('gives a different value with New Suggestion each time', async () => {
    const user = userEvent.setup();
    renderPanel();
    await chooseTemporary(user);

    const seen = [temporaryBox().value];
    for (let press = 0; press < 3; press += 1) {
      await user.click(screen.getByRole('button', { name: 'New Suggestion' }));
      const next = temporaryBox().value;
      expect(next).toMatch(TEMPORARY_FORM);
      expect(next).not.toBe(seen.at(-1));
      seen.push(next);
    }
  });

  it('hides the field again and drops its value when the invitation is chosen back, then offers a fresh one', async () => {
    const user = userEvent.setup();
    renderPanel();
    await chooseTemporary(user);
    const first = temporaryBox().value;

    await user.click(screen.getByRole('radio', { name: 'Email an invitation' }));

    expect(screen.queryByLabelText('Temporary password')).toBeNull();
    expect(screen.queryByDisplayValue(first)).toBeNull();
    await chooseTemporary(user);
    expect(temporaryBox().value).toMatch(TEMPORARY_FORM);
  });

  it('sends nothing of the dropped password when the invitation goes out after a switch back', async () => {
    const sent = answer();
    const user = userEvent.setup();
    const { onCreated } = renderPanel();
    await fill(user);
    await chooseTemporary(user);
    await user.click(screen.getByRole('radio', { name: 'Email an invitation' }));

    await user.click(createButton());

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
    expect(sent.bodies[0]).toEqual({
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana@example.ph',
      role: 'Admin',
      access: 'invitation',
    });
  });

  it('has no axe violations with the temporary route open', async () => {
    const user = userEvent.setup();
    renderPanel();
    await chooseTemporary(user);

    await expectNoAxeViolations(document.body);
  });
});

describe('U2 the temporary password rule (04 D-21)', () => {
  async function tryPassword(password: string) {
    const sent = answer();
    const user = userEvent.setup();
    renderPanel();
    await fill(user);
    await chooseTemporary(user);
    await user.clear(temporaryBox());
    if (password !== '') {
      await user.type(temporaryBox(), password);
    }
    await user.click(createButton());
    return { sent, user };
  }

  it.each([
    ['', 'Enter a temporary password.'],
    ['Ab1!', 'Use at least 8 characters.'],
    ['Abcdefgh!', 'Add at least one number.'],
    ['Abcdefgh1', 'Add at least one symbol, like ! or #.'],
    ['Ab1!'.repeat(17), 'Use 64 characters or fewer.'],
  ])('shows the message for %j before any request', async (password, message) => {
    const { sent } = await tryPassword(password);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(temporaryBox()).toHaveAttribute('aria-invalid', 'true');
    expect(temporaryBox()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it("accepts the person's own name inside it: only the basic rule applies", async () => {
    const { sent } = await tryPassword('Ana-Reyes-1234');

    await screen.findByLabelText('Temporary password for Ana');
    expect(sent.bodies[0]).toMatchObject({ temporaryPassword: 'Ana-Reyes-1234' });
  });

  it("shows the server's message under the field when it refuses the password", async () => {
    answer(() => problem(400, { errors: { temporaryPassword: ['Use at least 8 characters.'] } }));
    const user = userEvent.setup();
    renderPanel();
    await fill(user);
    await chooseTemporary(user);

    await user.click(createButton());

    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(temporaryBox()).toHaveFocus();
    expect(screen.queryByLabelText('Temporary password for Ana')).toBeNull();
  });
});

describe('U2 the shown-once step (D-14)', () => {
  it('posts the shown password on the temporary route and swaps to the step with focus on the read-only field', async () => {
    const sent = answer();
    const user = userEvent.setup();
    const { onCreated, onClose } = renderPanel();

    const password = await createWithTemporary(user);

    expect(sent.bodies).toEqual([
      {
        firstName: 'Ana',
        lastName: 'Reyes',
        email: 'ana@example.ph',
        role: 'Admin',
        access: 'temporary-password',
        temporaryPassword: password,
      },
    ]);
    const dialog = screen.getByRole('dialog', { name: 'User created' });
    expect(within(dialog).getByText('Ana Reyes · Admin')).toBeInTheDocument();
    expect(copyBox()).toHaveValue(password);
    expect(copyBox()).toHaveAttribute('readonly');
    expect(copyBox()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Copy Password' })).toBeInTheDocument();
    expect(within(dialog).getByText(SHOWN_ONCE_NOTE)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the form out of the step: a single Done button and nothing to edit or resubmit', async () => {
    answer();
    const user = userEvent.setup();
    renderPanel();

    await createWithTemporary(user);

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Create User|Creating)$/ })).toBeNull();
    expect(screen.queryByLabelText('Temporary password')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /^First name/ })).toBeNull();
  });

  it('closes with Done, reporting who was added', async () => {
    answer();
    const user = userEvent.setup();
    const { onCreated, onClose } = renderPanel();
    await createWithTemporary(user);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(onCreated).toHaveBeenCalledExactlyOnceWith({
      firstName: 'Ana',
      lastName: 'Reyes',
      role: 'Admin',
      access: 'temporary-password',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Esc', async (user: User) => user.keyboard('{Escape}')],
    ['the Close button', async (user: User) => user.click(screen.getByRole('button', { name: 'Close' }))],
    [
      'the scrim',
      async (user: User) => {
        const scrim = screen.getByRole('dialog').parentElement;
        if (scrim === null) {
          throw new Error('The panel has no scrim around it.');
        }
        await user.click(scrim);
      },
    ],
  ])('closes the same way with %s', async (_name, close) => {
    answer();
    const user = userEvent.setup();
    const { onCreated, onClose } = renderPanel();
    await createWithTemporary(user);

    await close(user);

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is gone for good once closed: a reopened panel is a clean form with a different suggestion', async () => {
    answer();
    const user = userEvent.setup();
    const handlers = { onClose: vi.fn(), onCreated: vi.fn() };
    const view = render(<AddUserPanel open {...handlers} />);
    const password = await createWithTemporary(user);

    view.rerender(<AddUserPanel open={false} {...handlers} />);

    expect(screen.queryByDisplayValue(password)).toBeNull();
    view.rerender(<AddUserPanel open {...handlers} />);
    expect(firstName()).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
    expect(screen.queryByDisplayValue(password)).toBeNull();
    await chooseTemporary(user);
    expect(temporaryBox().value).toMatch(TEMPORARY_FORM);
    expect(temporaryBox().value).not.toBe(password);
  });

  it('never puts the password in storage, the address, the title or the console', async () => {
    answer();
    const logs = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ];
    const user = userEvent.setup();
    renderPanel();

    const password = await createWithTemporary(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(storedText(localStorage)).not.toContain(password);
    expect(storedText(sessionStorage)).not.toContain(password);
    expect(window.location.href).not.toContain(password);
    expect(document.title).not.toContain(password);
    expect(
      logs
        .flatMap((log) => log.mock.calls)
        .flat()
        .join(' '),
    ).not.toContain(password);
  });

  it('has no axe violations in the step', async () => {
    answer();
    const user = userEvent.setup();
    renderPanel();
    await createWithTemporary(user);

    await expectNoAxeViolations(document.body);
  });
});
