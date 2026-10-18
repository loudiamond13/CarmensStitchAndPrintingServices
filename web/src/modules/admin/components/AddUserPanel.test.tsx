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
