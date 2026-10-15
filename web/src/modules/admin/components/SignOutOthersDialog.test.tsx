import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/actions';
import { ToastProvider } from '@/components/feedback';
import { SignOutOthersDialog } from '@/modules/admin/components/SignOutOthersDialog';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

/** The scrim around a dialog: its parent element. */
function scrimOf(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.parentElement;
  if (scrim === null) {
    throw new Error('The dialog has no scrim around it.');
  }
  return scrim;
}

// SignOutOthersDialog (D-44, D-05): shared by the S7 header button and the user menu (plan 04-30).

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function answerSignOutOthers(status = 204): { calls: number } {
  const probe = { calls: 0 };
  server.use(
    http.post('*/api/v1/auth/sign-out-others', () => {
      probe.calls += 1;
      return status === 204
        ? new HttpResponse(null, { status })
        : HttpResponse.json({ title: 'Boom', status, traceId: 'tr-9' }, { status });
    }),
  );
  return probe;
}

/** A button that opens the dialog, like the S7 header button, so focus return can be checked. */
function Opener({ onSignedOut }: { onSignedOut?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <ToastProvider>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </Button>
      {open && (
        <SignOutOthersDialog
          onClose={() => {
            setOpen(false);
          }}
          onSignedOut={onSignedOut}
        />
      )}
    </ToastProvider>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Open' }));
  return screen.getByRole('dialog', { name: 'Sign out of other devices?' });
}

describe('SignOutOthersDialog', () => {
  it('opens with "Keep Others Signed In" focused and says "other devices", never "all devices"', async () => {
    const user = userEvent.setup();
    render(<Opener />);

    const dialog = await openDialog(user);

    expect(within(dialog).getByRole('button', { name: 'Keep Others Signed In' })).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "You'll stay signed in on this device. Any other phone, tablet or computer signed in to your account will be signed out.",
    );
    expect(dialog.textContent).not.toMatch(/all devices/i);
    expect(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' })).toBeEnabled();
  });

  it('signs out the others, toasts, closes, calls onSignedOut and returns focus to the opener', async () => {
    const probe = answerSignOutOthers();
    const onSignedOut = vi.fn();
    const user = userEvent.setup();
    render(<Opener onSignedOut={onSignedOut} />);
    const opener = screen.getByRole('button', { name: 'Open' });

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    expect(await screen.findByText('Signed out of other devices')).toBeInTheDocument();
    expect(screen.getByText("You're still signed in on this device.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(probe.calls).toBe(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('shows the same toast when nothing was revoked (the server answers 204 either way)', async () => {
    answerSignOutOthers(204);
    const user = userEvent.setup();
    render(<Opener />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    expect(await screen.findByText('Signed out of other devices')).toBeInTheDocument();
  });

  it('shows "Signing out" and ignores Esc, the scrim, Keep Others Signed In and a second click while pending', async () => {
    const gate = deferred();
    let calls = 0;
    server.use(
      http.post('*/api/v1/auth/sign-out-others', async () => {
        calls += 1;
        await gate.promise;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<Opener />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));
    const pending = await within(dialog).findByRole('button', { name: 'Signing out' });
    await user.click(pending);
    await user.keyboard('{Escape}');
    await user.click(scrimOf(dialog));
    await user.click(within(dialog).getByRole('button', { name: 'Keep Others Signed In' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(calls).toBe(1);

    gate.resolve();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes on "Keep Others Signed In", Esc and the scrim when nothing is pending, with no request', async () => {
    const probe = answerSignOutOthers();
    const user = userEvent.setup();
    render(<Opener />);

    const first = await openDialog(user);
    await user.click(within(first).getByRole('button', { name: 'Keep Others Signed In' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await openDialog(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    const third = await openDialog(user);
    await user.click(scrimOf(third));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(probe.calls).toBe(0);
  });

  it('stays open on a failure with the mapper line above the buttons and allows a retry', async () => {
    answerSignOutOthers(500);
    const user = userEvent.setup();
    render(<Opener />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again. Reference: tr-9');
    expect(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' })).toHaveFocus();
    expect(screen.queryByText('Signed out of other devices')).toBeNull();

    answerSignOutOthers(204);
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));
    expect(await screen.findByText('Signed out of other devices')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations, also with a failure line', async () => {
    answerSignOutOthers(500);
    const user = userEvent.setup();
    const view = render(<Opener />);
    const dialog = await openDialog(user);
    await expectNoAxeViolations(view.container);

    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));
    await within(dialog).findByRole('alert');
    await expectNoAxeViolations(view.container);
  });
});
