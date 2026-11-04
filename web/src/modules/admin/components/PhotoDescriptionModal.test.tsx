import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PhotoDescriptionModal,
  type PhotoDescriptionModalProps,
} from '@/modules/admin/components/PhotoDescriptionModal';
import { expectNoAxeViolations } from '@/test/axe';

// The photo description window (UI-SPEC P5; D-12, OR-3, 08 D-58): one field, Cancel and Save Description. Here it works on a
// draft photo of the New Order form (no request); the live behaviour is added with plan 09-27.

function renderWindow(props: Partial<PhotoDescriptionModalProps> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <PhotoDescriptionModal
      mode="draft"
      orderLabel=""
      position={2}
      total={2}
      initial="New order photo 2"
      maxLength={200}
      onSave={onSave}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onSave, onClose, user: userEvent.setup() };
}

function field(): HTMLTextAreaElement {
  const box = screen.getByLabelText<HTMLTextAreaElement>('Photo description');
  return box;
}

describe('the draft description window (D-12)', () => {
  it('opens as Edit Description for "New order · Photo 2 of 2" with the text shown now selected', async () => {
    const { container } = renderWindow();

    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(within(dialog).getByText('New order · Photo 2 of 2')).toBeVisible();
    expect(field()).toHaveValue('New order photo 2');
    expect(field()).toHaveFocus();
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe('New order photo 2'.length);
    expect(
      within(dialog).getByText('Screen readers read this out. For example: Front mockup, red and black.'),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save Description' })).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('saves what was typed, trimmed, and closes with the caller told the text', async () => {
    const { user, onSave } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.type(field(), '  Back mockup ');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Back mockup');
  });

  it('saves an empty field as no description, so the default text stays', async () => {
    const { user, onSave } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(onSave).toHaveBeenCalledWith('');
  });

  it('saves the exact default text as no description', async () => {
    const { user, onSave } = renderWindow({ initial: 'Back mockup' });
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.type(field(), 'New order photo 2');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(onSave).toHaveBeenCalledWith('');
  });

  it('refuses more than the limit after trimming, with the server words, and saves nothing (OR-3)', async () => {
    const { user, onSave } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.click(field());
    await user.paste('a'.repeat(201));
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(await screen.findByText('Keep the description to 200 characters or fewer.')).toBeVisible();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('accepts exactly the limit once the spaces around it are trimmed', async () => {
    const { user, onSave } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.click(field());
    await user.paste(` ${'a'.repeat(200)} `);
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(onSave).toHaveBeenCalledWith('a'.repeat(200));
  });

  it('shows Saving on the button while the caller applies the text (UIC-11)', async () => {
    const { user } = renderWindow({ onSave: () => new Promise<void>(() => undefined) });
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.type(field(), '!');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    const saving = await screen.findByRole('button', { name: 'Saving' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Discard changes in the description window (08 D-58)', () => {
  it('closes at once on Esc when nothing was changed', async () => {
    const { user, onClose } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument();
  });

  it('asks "Discard changes?" on Esc after a change, and Keep Editing returns to the field', async () => {
    const { user, onClose } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.type(field(), ' x');

    await user.keyboard('{Escape}');

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(field()).toHaveFocus();
  });

  it('asks "Discard changes?" on Cancel after a change, and Discard Changes closes', async () => {
    const { user, onClose } = renderWindow();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.type(field(), ' x');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard Changes' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the live window words (P5)', () => {
  it('names the order and treats "Order {number} photo {n}" as the default text', async () => {
    const { user, onSave } = renderWindow({
      mode: 'live',
      orderLabel: 'ORD-2026-0148',
      position: 2,
      total: 5,
      initial: 'Back mockup',
    });

    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(within(dialog).getByText('ORD-2026-0148 · Photo 2 of 5')).toBeVisible();
    await user.clear(field());
    await user.type(field(), 'Order ORD-2026-0148 photo 2');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(onSave).toHaveBeenCalledWith('');
  });
});
