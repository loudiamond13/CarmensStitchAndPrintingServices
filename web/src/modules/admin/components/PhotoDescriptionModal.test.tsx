import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  PhotoDescriptionModal,
  type DraftDescriptionProps,
  type LiveDescriptionProps,
} from '@/modules/admin/components/PhotoDescriptionModal';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  ORDER_VERSION,
  orderImage,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The photo description window (UI-SPEC P5; D-12, OR-3, 08 D-58): one field, Cancel and Save Description. Here it works on a
// draft photo of the New Order form (no request); the live window saves a photo of a saved order (plan 09-27).

function renderWindow(props: Partial<DraftDescriptionProps> = {}) {
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

// The live window (P5; D-12, D-15, D-30): it saves a photo of a saved order with the version the window opened with.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

const PHOTO = orderImage(2);
const NEXT_VERSION = 'AAAAAAAAB9I=';

/** Photo 2 of 3 carries the description "Back mockup"; the other two keep the default text. */
function threePhotos(overrides: Partial<OrderDetailFixture> = {}): OrderDetailFixture {
  return buildOrderDetail({
    images: [orderImage(1), orderImage(2, { description: 'Back mockup' }), orderImage(3)],
    ...overrides,
  });
}

function renderLive(props: Partial<LiveDescriptionProps> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const order = threePhotos();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PhotoDescriptionModal
          mode="live"
          order={order}
          imageId={PHOTO.id}
          orderLabel={order.number}
          position={2}
          total={3}
          initial="Back mockup"
          maxLength={200}
          onSaved={onSaved}
          onClose={onClose}
          {...props}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, onSaved, onClose, user: userEvent.setup() };
}

function problem(status: number, code: string, message: string): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'Generic status words.',
      status,
      detail: message,
      instance: undefined,
      traceId: undefined,
      code,
      errors: {},
    },
  });
}

describe('the live description window (D-12, D-15, UIC-11)', () => {
  it('names the order and the place, selects the shown text and treats "Order {number} photo {n}" as the default text', async () => {
    const describePhoto = vi.spyOn(orderPhotosService, 'describe').mockResolvedValue(threePhotos());
    const { user } = renderLive();

    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(within(dialog).getByText('ORD-2026-0148 · Photo 2 of 3')).toBeVisible();
    expect(field()).toHaveValue('Back mockup');
    expect(field().selectionEnd).toBe('Back mockup'.length);
    await user.clear(field());
    await user.type(field(), 'Order ORD-2026-0148 photo 2');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    await waitFor(() => {
      expect(describePhoto).toHaveBeenCalledTimes(1);
    });
    expect(describePhoto).toHaveBeenCalledWith(threePhotos().id, PHOTO.id, '', ORDER_VERSION);
  });

  it('shows Saving while the request runs, sends the opened version once, and hands the answer on', async () => {
    const answer = threePhotos({ version: NEXT_VERSION });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const describePhoto = vi.spyOn(orderPhotosService, 'describe').mockImplementation(async () => {
      await gate;
      return answer;
    });
    const { user, onSaved } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.clear(field());
    await user.type(field(), '  Front mockup ');

    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    const saving = await screen.findByRole('button', { name: 'Saving' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    await user.click(saving);
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(answer);
    });
    expect(describePhoto).toHaveBeenCalledTimes(1);
    expect(describePhoto).toHaveBeenCalledWith(answer.id, PHOTO.id, 'Front mockup', ORDER_VERSION);
  });

  it('sends "" for an empty field, so the stored description is cleared', async () => {
    const describePhoto = vi.spyOn(orderPhotosService, 'describe').mockResolvedValue(threePhotos());
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    await waitFor(() => {
      expect(describePhoto).toHaveBeenCalledWith(expect.any(String), PHOTO.id, '', ORDER_VERSION);
    });
  });

  it('refuses more than the limit after trimming, with the server words, and sends nothing (OR-3)', async () => {
    const describePhoto = vi.spyOn(orderPhotosService, 'describe');
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.clear(field());
    await user.click(field());
    await user.paste('a'.repeat(201));
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(await screen.findByText('Keep the description to 200 characters or fewer.')).toBeVisible();
    expect(describePhoto).not.toHaveBeenCalled();
  });

  it('counts the limit as JavaScript string length after trim, the same measure as the server (EDGE ORD-04 encoding)', async () => {
    const describePhoto = vi.spyOn(orderPhotosService, 'describe').mockResolvedValue(threePhotos());
    const { user } = renderLive({ maxLength: 4 });
    await screen.findByRole('dialog', { name: 'Edit Description' });

    // Two emoji are 4 UTF-16 units: at the limit. A third makes 6 units and is over, though it is only 3 characters.
    await user.clear(field());
    await user.click(field());
    await user.paste('😀😀');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));
    await waitFor(() => {
      expect(describePhoto).toHaveBeenCalledTimes(1);
    });
    await user.clear(field());
    await user.paste('😀😀😀');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(await screen.findByText('Keep the description to 4 characters or fewer.')).toBeVisible();
    expect(describePhoto).toHaveBeenCalledTimes(1);
  });

  it('wraps a very long order number in the window description (UIC-41)', async () => {
    const number = `ORD-${'9'.repeat(300)}`;
    renderLive({ orderLabel: number });

    const description = await screen.findByText(`${number} · Photo 2 of 3`);

    expect(description).toHaveClass('wrap-anywhere');
  });

  it('has no axe violations', async () => {
    const { container } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await expectNoAxeViolations(container);
  });
});

describe('a refused live description save (D-15, UIC-17, UIC-18, UIC-19)', () => {
  it('shows the ConflictBanner on a 409, keeps the typed text, and Load Latest puts the latest description in the field', async () => {
    vi.spyOn(orderPhotosService, 'describe').mockRejectedValue(
      problem(409, 'edit.stale', 'Someone else changed this.'),
    );
    const latest = threePhotos({
      images: [orderImage(1), orderImage(2, { description: 'Server text' }), orderImage(3)],
      version: NEXT_VERSION,
    });
    useOrderHandlers({ detail: latest });
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.clear(field());
    await user.type(field(), 'My text');

    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    expect(screen.getByText('This was changed by someone else.')).toBeVisible();
    expect(field()).toHaveValue('My text');

    await user.click(loadLatest);

    await waitFor(() => {
      expect(field()).toHaveValue('Server text');
    });
    expect(screen.queryByRole('button', { name: 'Load Latest' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Description' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('sends the latest version after Load Latest', async () => {
    const describePhoto = vi
      .spyOn(orderPhotosService, 'describe')
      .mockRejectedValueOnce(problem(409, 'edit.stale', 'Someone else changed this.'))
      .mockResolvedValueOnce(threePhotos());
    useOrderHandlers({ detail: threePhotos({ version: NEXT_VERSION }) });
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.type(field(), '!');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));
    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load Latest' })).not.toBeInTheDocument();
    });

    await user.type(field(), '?');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    await waitFor(() => {
      expect(describePhoto).toHaveBeenCalledTimes(2);
    });
    expect(describePhoto.mock.calls[1]?.[3]).toBe(NEXT_VERSION);
  });

  it('says the photo was removed on a 404 and keeps Save aria-disabled', async () => {
    vi.spyOn(orderPhotosService, 'describe').mockRejectedValue(
      problem(404, 'images.not-found', 'This photo is no longer on this order.'),
    );
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.type(field(), '!');

    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(await screen.findByText('This photo was removed.')).toBeVisible();
    expect(screen.getByText('Close this and check the order.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Description' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the server text on a 422 orders.locked and keeps Save aria-disabled', async () => {
    const message = 'This order is completed. Reopen it to make changes.';
    vi.spyOn(orderPhotosService, 'describe').mockRejectedValue(problem(422, 'orders.locked', message));
    const { user } = renderLive();
    await screen.findByRole('dialog', { name: 'Edit Description' });
    await user.type(field(), '!');

    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Description' })).toHaveAttribute('aria-disabled', 'true');
  });
});
