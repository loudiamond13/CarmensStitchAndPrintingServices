import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { ClosureModal } from '@/modules/admin/components/ClosureModal';
import type { ShopClosure } from '@/modules/admin/services/shopClosuresService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { businessTodayIs, demoClosures, problemAnswer, shopClosuresBackend } from '@/test/siteContentFixtures';

// S2 ClosureModal (CONT-04, OR-3, D-22; plan 11-16): add and edit one closure with the approved rules. The business today comes from the server,
// never from this device's clock, so these tests use a date years away from now.

vi.setConfig({ testTimeout: 15_000 });

const TODAY = '2031-03-04';

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  businessTodayIs(TODAY);
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

interface Props {
  closure?: ShopClosure;
  onClose?: () => void;
  onSaved?: (saved: ShopClosure) => void;
}

function renderModal({ closure, onClose = vi.fn(), onSaved = vi.fn() }: Props = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {closure === undefined ? (
          <ClosureModal mode="add" onClose={onClose} onSaved={onSaved} />
        ) : (
          <ClosureModal mode="edit" closure={closure} onClose={onClose} onSaved={onSaved} />
        )}
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup(), onClose, onSaved };
}

const first = (): HTMLInputElement => screen.getByLabelText(/^First day/);
const last = (): HTMLInputElement => screen.getByLabelText(/^Last day/);
const note = (): HTMLInputElement => screen.getByLabelText(/^Public note/);

function pick(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

describe('the add window', () => {
  it('has the title, the three fields with their hints and the Cancel and Save Closure buttons', async () => {
    shopClosuresBackend();
    renderModal();

    expect(await screen.findByRole('dialog', { name: 'Add Closure' })).toBeVisible();
    expect(first()).toBeVisible();
    expect(last()).toBeVisible();
    expect(screen.getByText('Leave empty for one day. Up to 31 days.')).toBeVisible();
    expect(note()).toHaveAttribute('placeholder', 'e.g. Christmas');
    expect(screen.getByText('Shown on the Contact page, like Closed today for Christmas.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Closure' })).toBeVisible();
  });

  it("starts First day on the business today from the server, not the device's date", async () => {
    shopClosuresBackend();
    renderModal();

    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    expect(last()).toHaveValue('');
    expect(note()).toHaveValue('');
  });

  it('shows "Pick today or a later date." for a first day before today, sends nothing and focuses First day', async () => {
    const backend = shopClosuresBackend();
    const { user } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    pick(first(), '2031-03-03');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('Pick today or a later date.')).toBeVisible();
    expect(first()).toHaveFocus();
    expect(backend.posts).toHaveLength(0);
  });

  it('shows "A closure can be up to 31 days. Add another one for longer." for a 32 day span', async () => {
    const backend = shopClosuresBackend();
    const { user } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    pick(last(), '2031-04-04');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('A closure can be up to 31 days. Add another one for longer.')).toBeVisible();
    expect(last()).toHaveFocus();
    expect(backend.posts).toHaveLength(0);
  });

  it('shows "The last day must be on or after the first day." for a last day before the first', async () => {
    shopClosuresBackend();
    const { user } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    pick(last(), '2031-03-02');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('The last day must be on or after the first day.')).toBeVisible();
  });

  it('shows "Keep the note to 80 characters or fewer." for an 81 character note', async () => {
    const backend = shopClosuresBackend();
    const { user } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    pick(note(), 'a'.repeat(81));

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('Keep the note to 80 characters or fewer.')).toBeVisible();
    expect(note()).toHaveFocus();
    expect(backend.posts).toHaveLength(0);
  });

  it('sends POST with the checked values and one Idempotency-Key, then hands the closure on and closes', async () => {
    const backend = shopClosuresBackend();
    const { user, onSaved, onClose } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    pick(first(), '2031-03-10');
    await user.type(note(), '  Year-end inventory ');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.body).toEqual({
      firstDay: '2031-03-10',
      lastDay: null,
      note: 'Year-end inventory',
      version: null,
    });
    expect(backend.posts[0]?.key).toMatch(/\S/);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ firstDay: '2031-03-10', note: 'Year-end inventory' }),
    );
  });

  it("puts the server's overlap message under First day, keeps the window open and focuses First day", async () => {
    shopClosuresBackend(demoClosures, {
      onPost: () => problemAnswer(400, { errors: { firstDay: ["There's already a closure on Dec 25, 2026."] } }),
    });
    const { user, onClose, onSaved } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText("There's already a closure on Dec 25, 2026.")).toBeVisible();
    expect(first()).toHaveFocus();
    expect(first()).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    shopClosuresBackend();
    const { baseElement } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });

    await expectNoAxeViolations(baseElement);
  });
});

describe('the discard guard (08 D-58)', () => {
  it('closes a window nobody changed at once', async () => {
    shopClosuresBackend();
    const { user, onClose } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('asks "Discard changes?" before closing a changed window, and Keep Editing leaves it open', async () => {
    shopClosuresBackend();
    const { user, onClose } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    await user.type(note(), 'Holiday');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const question = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(question).getByRole('button', { name: 'Keep Editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(note()).toHaveValue('Holiday');
  });

  it('closes on Discard Changes', async () => {
    shopClosuresBackend();
    const { user, onClose } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });
    await user.type(note(), 'Holiday');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const question = await screen.findByRole('dialog', { name: 'Discard changes?' });

    await user.click(within(question).getByRole('button', { name: 'Discard Changes' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not count the business today arriving as a change', async () => {
    shopClosuresBackend();
    const { user, onClose } = renderModal();
    await waitFor(() => {
      expect(first()).toHaveValue(TODAY);
    });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('the edit window (OI-1, option A)', () => {
  const [christmas] = demoClosures;
  if (christmas === undefined) {
    throw new Error('The demo closures are empty.');
  }
  /** A closure that already started: its first day is before the business today. */
  const running: ShopClosure = {
    id: '6f1c2a10-0000-4000-8000-0000000000aa',
    firstDay: '2031-03-01',
    lastDay: '2031-03-06',
    note: 'Repairs',
    version: 'AAAAAAAAD77=',
  };

  it('opens with the title, the saved days and note', async () => {
    shopClosuresBackend();
    renderModal({ closure: christmas });

    expect(await screen.findByRole('dialog', { name: 'Edit Closure' })).toBeVisible();
    expect(first()).toHaveValue('2026-12-25');
    expect(last()).toHaveValue('');
    expect(note()).toHaveValue('Christmas');
  });

  it('sends PUT with the version it opened with', async () => {
    const backend = shopClosuresBackend();
    const { user, onSaved } = renderModal({ closure: christmas });
    await user.clear(note());
    await user.type(note(), 'Christmas Day');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts).toEqual([
      {
        id: christmas.id,
        body: { firstDay: '2026-12-25', lastDay: null, note: 'Christmas Day', version: christmas.version },
      },
    ]);
  });

  it('keeps a first day that is already past when it is left alone, so the note of a running closure can be fixed', async () => {
    const backend = shopClosuresBackend([running]);
    const { user, onSaved } = renderModal({ closure: running });
    await waitFor(() => {
      expect(first()).toHaveValue('2031-03-01');
    });
    await user.clear(note());
    await user.type(note(), 'Repairs done soon');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts[0]?.body).toEqual({
      firstDay: '2031-03-01',
      lastDay: '2031-03-06',
      note: 'Repairs done soon',
      version: running.version,
    });
  });

  it('refuses moving a past first day to another past day', async () => {
    const backend = shopClosuresBackend([running]);
    const { user } = renderModal({ closure: running });
    await waitFor(() => {
      expect(first()).toHaveValue('2031-03-01');
    });
    pick(first(), '2031-03-02');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('Pick today or a later date.')).toBeVisible();
    expect(backend.puts).toHaveLength(0);
  });

  it('on a stale save keeps the typed values behind the conflict banner, and Load Latest shows their words and uses the new version', async () => {
    const backend = shopClosuresBackend([christmas], {
      onPut: (_id, _body, current) => {
        if (current.puts.length > 1) {
          return undefined;
        }
        current.current = [{ ...christmas, note: 'Their note', version: 'AAAAAAAAD88=' }];
        return problemAnswer(409, { code: 'edit.stale' });
      },
    });
    const { user, onSaved } = renderModal({ closure: christmas });
    await user.clear(note());
    await user.type(note(), 'My note');

    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('This was changed by someone else.')).toBeVisible();
    expect(note()).toHaveValue('My note');

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(note()).toHaveValue('Their note');
    });
    await user.click(screen.getByRole('button', { name: 'Save Closure' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts[1]?.body.version).toBe('AAAAAAAAD88=');
  });
});
