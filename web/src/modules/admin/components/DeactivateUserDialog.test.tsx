import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { DeactivateUserDialog } from '@/modules/admin/components/DeactivateUserDialog';
import { expectNoAxeViolations } from '@/test/axe';

// DeactivateUserDialog (U4, OQ-3; plan 05-28): the confirm behind the row's Deactivate toggle, with the ConfirmDialog failure rule.

const PERSON = { firstName: 'Paolo', lastName: 'Garcia' };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The scrim around a dialog: its parent element. */
function scrimOf(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.parentElement;
  if (scrim === null) {
    throw new Error('The dialog has no scrim around it.');
  }
  return scrim;
}

function refusal(status: number, code: string): HttpError {
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
      code,
      errors: {},
    },
  });
}

function renderDialog(onConfirm: () => unknown = () => ({ ok: true }), onCancel: () => void = () => undefined) {
  return render(<DeactivateUserDialog user={PERSON} onConfirm={onConfirm} onCancel={onCancel} />);
}

describe('DeactivateUserDialog', () => {
  it('is named for the person, says what happens, and focuses "Keep Active"', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Deactivate Paolo Garcia?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Active' })).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "They'll be signed out on every device and can't sign in. Their records stay on orders and expenses. You can activate them again later.",
    );
    expect(within(dialog).getByRole('button', { name: 'Deactivate User' })).toBeEnabled();
  });

  it('calls onCancel for "Keep Active", Esc and the scrim when nothing is pending', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog(undefined, onCancel);

    await user.click(screen.getByRole('button', { name: 'Keep Active' }));
    await user.keyboard('{Escape}');
    await user.click(scrimOf(screen.getByRole('dialog')));

    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('calls onConfirm once, even for a second click while it is pending, and shows "Deactivating"', async () => {
    const gate = deferred<{ ok: true }>();
    const onConfirm = vi.fn(() => gate.promise);
    const user = userEvent.setup();
    renderDialog(onConfirm);

    const confirm = screen.getByRole('button', { name: 'Deactivate User' });
    await user.click(confirm);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deactivating' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
  });

  it('ignores Esc, the scrim, "Keep Active" and Close while pending', async () => {
    const gate = deferred<{ ok: true }>();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog(() => gate.promise, onCancel);

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));
    await user.keyboard('{Escape}');
    await user.click(scrimOf(screen.getByRole('dialog')));
    await user.click(screen.getByRole('button', { name: 'Keep Active' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
  });

  it('stays open on a failed outcome with the mapper line in a role alert and focus back on "Deactivate User"', async () => {
    const user = userEvent.setup();
    renderDialog(() => Promise.resolve({ ok: false, error: new HttpError({ kind: 'network' }) }));

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
    expect(within(dialog).getByRole('button', { name: 'Deactivate User' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Deactivate User' })).not.toHaveAttribute('aria-busy', 'true');
  });

  it('shows the last-Manager guard line for a 422 users.last-active-manager', async () => {
    const user = userEvent.setup();
    renderDialog(() => Promise.resolve({ ok: false, error: refusal(422, 'users.last-active-manager') }));

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You can't remove the last active Manager. Make another user a Manager first, then try again.",
    );
  });

  it('says the user was deleted for a 404', async () => {
    const user = userEvent.setup();
    renderDialog(() => Promise.resolve({ ok: false, error: refusal(404, 'users.not-found') }));

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This user was deleted. Close this and refresh the list.');
  });

  it('allows a retry after a failure and clears the line when the retry succeeds', async () => {
    const onConfirm = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ ok: false, error: new Error('x') })
      .mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('renders nothing while open is false', () => {
    render(<DeactivateUserDialog open={false} user={PERSON} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations, also with a failure line', async () => {
    const user = userEvent.setup();
    const view = renderDialog(() => Promise.resolve({ ok: false, error: new Error('x') }));
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Deactivate User' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations(view.container);
  });
});
