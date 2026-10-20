import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { SignOutDeviceDialog } from '@/modules/admin/components/SignOutDeviceDialog';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';
import { expectNoAxeViolations } from '@/test/axe';

/** The scrim around a dialog: its parent element. */
function scrimOf(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.parentElement;
  if (scrim === null) {
    throw new Error('The dialog has no scrim around it.');
  }
  return scrim;
}

// SignOutDeviceDialog (S7, D-43): the confirm for one device, with the ConfirmDialog failure rule and the pending lock.

const DEVICE: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000002',
  device: 'Safari on iPhone',
  signedInAt: '2026-10-11T02:15:00Z',
  lastActiveAt: '2026-10-12T09:00:00Z',
  persistent: false,
  current: false,
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderDialog(onConfirm: () => unknown = () => ({ ok: true }), onCancel: () => void = () => undefined) {
  return render(<SignOutDeviceDialog device={DEVICE} onConfirm={onConfirm} onCancel={onCancel} />);
}

describe('SignOutDeviceDialog', () => {
  it('is named for the device, shows when it signed in, and focuses "Keep Signed In"', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Sign out Safari on iPhone?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Signed In' })).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "Signed in Oct 11, 2026, 10:15 AM. That device will have to sign in again with the password and an emailed code. If you don't recognize it, sign it out and tell a Manager.",
    );
    expect(within(dialog).getByRole('button', { name: 'Sign Out Device' })).toBeEnabled();
  });

  it('calls onCancel for "Keep Signed In", Esc and the scrim when nothing is pending', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog(undefined, onCancel);

    await user.click(screen.getByRole('button', { name: 'Keep Signed In' }));
    await user.keyboard('{Escape}');
    const scrim = scrimOf(screen.getByRole('dialog'));
    await user.click(scrim);

    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('calls onConfirm once, even for a second click while it is pending, and shows "Signing out"', async () => {
    const gate = deferred<{ ok: true }>();
    const onConfirm = vi.fn(() => gate.promise);
    const user = userEvent.setup();
    renderDialog(onConfirm);

    const confirm = screen.getByRole('button', { name: 'Sign Out Device' });
    await user.click(confirm);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing out' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
  });

  it('ignores Esc, the scrim and "Keep Signed In" while pending', async () => {
    const gate = deferred<{ ok: true }>();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog(() => gate.promise, onCancel);

    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));
    await user.keyboard('{Escape}');
    await user.click(scrimOf(screen.getByRole('dialog')));
    await user.click(screen.getByRole('button', { name: 'Keep Signed In' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
  });

  it('stays open on a failed outcome with the mapper line in a role alert and focus back on "Sign Out Device"', async () => {
    const error = new HttpError({ kind: 'network' });
    const user = userEvent.setup();
    renderDialog(() => Promise.resolve({ ok: false, error }));

    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
    expect(within(dialog).getByRole('button', { name: 'Sign Out Device' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Sign Out Device' })).not.toHaveAttribute('aria-busy', 'true');
  });

  it('allows a retry after a failure and clears the line when the retry succeeds', async () => {
    const onConfirm = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ ok: false, error: new Error('x') })
      .mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    renderDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('has no axe violations, also with a failure line', async () => {
    const user = userEvent.setup();
    const view = renderDialog(() => Promise.resolve({ ok: false, error: new Error('x') }));
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations(view.container);
  });
});

// D-39: the dialog may stay mounted with `open` false so its close animation can play; each new open starts clean.
describe('SignOutDeviceDialog open prop (D-39)', () => {
  it('is open when open is omitted and renders nothing when it is false', () => {
    const { rerender } = render(<SignOutDeviceDialog device={DEVICE} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<SignOutDeviceDialog open={false} device={DEVICE} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens again without the failure line', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new HttpError({ kind: 'http', status: 500, problem: undefined })));
    const user = userEvent.setup();
    const { rerender } = render(<SignOutDeviceDialog device={DEVICE} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Sign Out Device' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    rerender(<SignOutDeviceDialog open={false} device={DEVICE} onConfirm={onConfirm} onCancel={vi.fn()} />);
    rerender(<SignOutDeviceDialog open device={DEVICE} onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign Out Device' })).toBeEnabled();
  });
});
