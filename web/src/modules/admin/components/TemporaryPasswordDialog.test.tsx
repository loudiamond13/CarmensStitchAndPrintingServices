import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { TemporaryPasswordDialog } from '@/modules/admin/components/TemporaryPasswordDialog';
import { expectNoAxeViolations } from '@/test/axe';

// TemporaryPasswordDialog (U5, C-4, 04 D-21, D-14, T-05-87; plan 05-30): the set step with a readable suggestion, and the
// shown-once step that holds the password in component state only.

const PERSON = { firstName: 'Paolo', lastName: 'Garcia' };
const READABLE = /^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** The scrim around a dialog: its parent element. */
function scrimOf(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.parentElement;
  if (scrim === null) {
    throw new Error('The dialog has no scrim around it.');
  }
  return scrim;
}

function refusal(status: number, body: { code?: string; errors?: Record<string, string[]> }): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'x',
      status,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: body.code,
      errors: body.errors ?? {},
    },
  });
}

type OnSet = (temporaryPassword: string, idempotencyKey: string) => Promise<unknown>;

function renderDialog(onSet: OnSet = () => Promise.resolve(undefined), onClose: () => void = () => undefined) {
  return render(<TemporaryPasswordDialog user={PERSON} onSet={onSet} onClose={onClose} />);
}

const field = () => screen.getByLabelText<HTMLInputElement>('Temporary password', { exact: true });
const setButton = () => screen.getByRole('button', { name: /^(Set Password|Setting)$/ });

describe('TemporaryPasswordDialog set step', () => {
  it('is titled "Set a temporary password", names the person, and puts focus on the prefilled password', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Set a temporary password' });
    expect(within(dialog).getByText('For Paolo Garcia')).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(field().value).toMatch(READABLE);
    expect(
      within(dialog).getByText("Share it privately. They'll be asked to change it on first sign-in."),
    ).toBeInTheDocument();
  });

  it('says who is signed out and what they are emailed, before the button', () => {
    renderDialog();

    expect(
      screen.getByText(
        "This signs Paolo out on every device and emails them that a Manager reset their password. They'll choose their own password at the next sign-in.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(setButton()).toHaveTextContent('Set Password');
  });

  it('New Suggestion replaces the value with a different readable one each time', async () => {
    const user = userEvent.setup();
    renderDialog();
    const seen = new Set([field().value]);

    for (let index = 0; index < 3; index += 1) {
      await user.click(screen.getByRole('button', { name: 'New Suggestion' }));
      expect(field().value).toMatch(READABLE);
      expect(seen.has(field().value)).toBe(false);
      seen.add(field().value);
    }
  });

  it('shows a broken basic rule before any request is sent', async () => {
    const onSet = vi.fn<OnSet>(() => Promise.resolve(undefined));
    const user = userEvent.setup();
    renderDialog(onSet);

    await user.clear(field());
    await user.click(setButton());
    expect(await screen.findByText('Enter a temporary password.')).toBeInTheDocument();
    expect(field()).toHaveFocus();

    await user.type(field(), 'Abcdefgh!');
    await user.click(setButton());
    expect(await screen.findByText('Add at least one number.')).toBeInTheDocument();

    expect(onSet).not.toHaveBeenCalled();
  });

  it('sends the typed password with one Idempotency-Key and shows "Setting" while it runs', async () => {
    const gate = deferred<unknown>();
    const onSet = vi.fn<OnSet>(() => gate.promise);
    const user = userEvent.setup();
    renderDialog(onSet);
    await user.clear(field());
    await user.type(field(), 'Tela-Sukat-7381');

    await user.click(setButton());
    await user.click(setButton());

    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenCalledWith('Tela-Sukat-7381', expect.any(String));
    expect(screen.getByRole('button', { name: 'Setting' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      gate.resolve(undefined);
      await gate.promise;
    });
  });

  it('ignores Esc, the scrim, Cancel and Close while it runs', async () => {
    const gate = deferred<unknown>();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(() => gate.promise, onClose);

    await user.click(setButton());
    await user.keyboard('{Escape}');
    await user.click(scrimOf(screen.getByRole('dialog')));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      gate.resolve(undefined);
      await gate.promise;
    });
  });

  it('calls onClose for Cancel, Esc and the scrim when nothing runs', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(undefined, onClose);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(scrimOf(screen.getByRole('dialog')));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('puts the server message for the password under the field with the cursor there', async () => {
    const user = userEvent.setup();
    renderDialog(() =>
      Promise.reject(refusal(400, { errors: { temporaryPassword: ['Add at least one symbol, like ! or #.'] } })),
    );

    await user.click(setButton());

    expect(await screen.findByText('Add at least one symbol, like ! or #.')).toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('keeps the dialog open with an alert line for any other failure, and a retry sends the same key', async () => {
    const onSet = vi
      .fn<OnSet>()
      .mockRejectedValueOnce(new HttpError({ kind: 'network' }))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderDialog(onSet);

    await user.click(setButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
    expect(setButton()).toHaveFocus();
    await user.click(setButton());
    await screen.findByRole('dialog', { name: 'Temporary password set' });
    expect(onSet).toHaveBeenCalledTimes(2);
    expect(onSet.mock.calls[1]?.[1]).toBe(onSet.mock.calls[0]?.[1]);
  });

  it.each([
    [422, 'users.own-account', "You can't do this to your own account. Change your own details in My Profile."],
    [422, 'users.blocked', 'This account is locked or deactivated. Unlock or activate this person first.'],
  ])('words a %i %s refusal in plain English', async (status, code, line) => {
    const user = userEvent.setup();
    renderDialog(() => Promise.reject(refusal(status, { code })));

    await user.click(setButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(line);
  });

  it('renders nothing while open is false', () => {
    render(<TemporaryPasswordDialog open={false} user={PERSON} onSet={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations on the set step, also with a failure line', async () => {
    const user = userEvent.setup();
    const view = renderDialog(() => Promise.reject(new Error('x')));
    await expectNoAxeViolations(view.container);

    await user.click(setButton());
    await screen.findByRole('alert');
    await expectNoAxeViolations(view.container);
  });
});

describe('TemporaryPasswordDialog shown-once step (D-14)', () => {
  async function setIt(onClose: () => void = () => undefined) {
    const user = userEvent.setup();
    const view = renderDialog(undefined, onClose);
    await user.clear(field());
    await user.type(field(), 'Tela-Sukat-7381');
    await user.click(setButton());
    const dialog = await screen.findByRole('dialog', { name: 'Temporary password set' });
    return { user, view, dialog };
  }

  it('shows "Temporary password set" with the read-only password focused, the Note, and only Done', async () => {
    const { dialog } = await setIt();

    const shown = within(dialog).getByLabelText<HTMLInputElement>('Temporary password for Paolo');
    expect(shown).toHaveValue('Tela-Sukat-7381');
    expect(shown).toHaveAttribute('readonly');
    expect(shown).toHaveFocus();
    expect(within(dialog).getByText('For Paolo Garcia')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This is the only time you'll see this password. Copy it now and give it to Paolo in person or by private message. If it gets lost, set a new one.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copy Password' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Set Password$/ })).toBeNull();
  });

  it('closes for Done, Esc, the scrim and Close', async () => {
    const onClose = vi.fn();
    const { user, dialog } = await setIt(onClose);

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await user.keyboard('{Escape}');
    await user.click(scrimOf(dialog));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('forgets the password once it is closed: the page holds no trace of it', async () => {
    const view = renderDialog();
    const user = userEvent.setup();
    await user.clear(field());
    await user.type(field(), 'Tela-Sukat-7381');
    await user.click(setButton());
    await screen.findByDisplayValue('Tela-Sukat-7381');

    view.rerender(<TemporaryPasswordDialog open={false} user={PERSON} onSet={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(document.body.innerHTML).not.toContain('Tela-Sukat-7381');
    });
  });

  it('opens again on the set step with a fresh suggestion, never the earlier value', async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    const first = field().value;
    await user.click(setButton());
    await screen.findByDisplayValue(first);

    view.rerender(<TemporaryPasswordDialog open={false} user={PERSON} onSet={vi.fn()} onClose={vi.fn()} />);
    view.rerender(<TemporaryPasswordDialog open user={PERSON} onSet={vi.fn()} onClose={vi.fn()} />);

    const dialog = await screen.findByRole('dialog', { name: 'Set a temporary password' });
    expect(dialog).toBeInTheDocument();
    expect(field().value).toMatch(READABLE);
    expect(field().value).not.toBe(first);
    expect(document.body.innerHTML).not.toContain(first);
  });

  it('has no axe violations on the shown-once step', async () => {
    const { view } = await setIt();

    await expectNoAxeViolations(view.container);
  });
});
