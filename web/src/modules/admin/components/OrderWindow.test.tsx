import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderWindow, type OrderWindowProps } from '@/modules/admin/components/OrderWindow';

// The shared frame of the order windows (UI-SPEC O2, D-58; plan 08-14): the title and description, the body, the footer and the
// banner slot. Item, payment, discount, expense and refund windows all sit in it.

function renderWindow(props: Partial<OrderWindowProps> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <OrderWindow
      title="Add Item"
      description="ORD-2026-0148 · Brgy. San Roque Ballers"
      isDirty={false}
      pending={false}
      saveLabel="Save Item"
      onSave={onSave}
      onClose={onClose}
      {...props}
    >
      <label>
        Name
        <input type="text" name="name" />
      </label>
    </OrderWindow>,
  );
  return { ...view, onSave, onClose };
}

describe('the frame', () => {
  it('shows the title, the description, the body and the footer buttons', () => {
    renderWindow();

    const dialog = screen.getByRole('dialog', { name: 'Add Item' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Item' })).toBeInTheDocument();
  });

  it('saves through the form when Save is pressed and when Enter is pressed in a field', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWindow();

    await user.click(screen.getByRole('button', { name: 'Save Item' }));
    await user.type(screen.getByLabelText('Name'), 'x{Enter}');

    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('shows "Saving" and does not save again while pending', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWindow({ pending: true });

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('makes Save aria-disabled when it is blocked', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWindow({ saveBlocked: true });

    const button = screen.getByRole('button', { name: 'Save Item' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('ends the body with the record meta it is given', () => {
    renderWindow({ recordMeta: <p>Recorded by Carmen</p> });

    expect(screen.getByText('Recorded by Carmen')).toBeInTheDocument();
  });
});

describe('the banners', () => {
  it('shows the stale-save banner with Load Latest, and Load Latest calls back', async () => {
    const user = userEvent.setup();
    const onLoadLatest = vi.fn();
    renderWindow({ banner: { kind: 'conflict', count: 1 }, onLoadLatest });

    expect(screen.getByText('This was changed by someone else.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load Latest' }));

    expect(onLoadLatest).toHaveBeenCalledTimes(1);
  });

  it('shows the removed banner with both lines', () => {
    renderWindow({
      banner: { kind: 'removed', title: 'This item was removed.', body: 'Close this and check the order.' },
    });

    expect(screen.getByText('This item was removed.')).toBeInTheDocument();
    expect(screen.getByText('Close this and check the order.')).toBeInTheDocument();
  });

  it('shows a refusal as an alert line in the window', () => {
    renderWindow({ banner: { kind: 'message', text: 'This order is completed. Reopen it to make changes.' } });

    expect(screen.getByRole('alert')).toHaveTextContent('This order is completed. Reopen it to make changes.');
  });
});

describe('closing a clean window (D-58)', () => {
  it('closes at once on Cancel, Esc and the close button, with no question asked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('closes nothing while saving', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ pending: true });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('closing a dirty window (D-58, UIC-43)', () => {
  it.each([
    [
      'Cancel',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Cancel' })),
    ],
    ['Esc', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'the close button',
      async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Close' })),
    ],
  ])('asks "Discard changes?" on %s and Keep Editing is focused first', async (_name, close) => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ isDirty: true });

    await close(user);

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(
      within(dialog).getByText("What you typed in this window hasn't been saved. If you close it now, it's lost."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Keep Editing keeps the window and returns focus to the control that tried to close', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ isDirty: true });
    const cancel = screen.getByRole('button', { name: 'Cancel' });

    await user.click(cancel);
    await user.click(await screen.findByRole('button', { name: 'Keep Editing' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add Item' })).toBeInTheDocument();
    expect(cancel).toHaveFocus();
  });

  it('Discard Changes closes the window', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ isDirty: true });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc on the question closes only the question', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ isDirty: true });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add Item' })).toBeInTheDocument();
  });
});
