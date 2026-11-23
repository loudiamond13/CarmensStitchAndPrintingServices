import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { QuoteStatusMenu } from '@/modules/admin/components/QuoteStatusMenu';
import type { QuoteRequestDetailResponse } from '@/modules/admin/services/quoteRequestsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { quoteProblem, quoteRequestBackend, quoteRequestDetail, quoteRequestId } from '@/test/quoteRequestFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The quote request Change Status menu (D-15, D-04; UI-SPEC R2): "Move to {Status}" for every status but the current one and
// Converted, the OrderStatusMenu keys, the version and an Idempotency-Key on each move, and a confirm before Spam deletes photos.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

const ID = quoteRequestId(1);

interface Callbacks {
  onMoved?: () => void;
  onConflict?: () => void;
}

function renderMenu(request: QuoteRequestDetailResponse = quoteRequestDetail(ID), callbacks: Callbacks = {}) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <QuoteStatusMenu
          request={request}
          onMoved={callbacks.onMoved ?? vi.fn()}
          onConflict={callbacks.onConflict ?? vi.fn()}
        />
        <button type="button">Elsewhere</button>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, ...view };
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Change Status' });
}

function itemNames(): string[] {
  return within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => item.textContent);
}

describe('the menu items (D-15)', () => {
  it('lists Move to Contacted, Quoted, Closed and Spam on a New request: no New and no Converted', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu();

    await user.click(trigger());

    expect(itemNames()).toEqual(['Move to Contacted', 'Move to Quoted', 'Move to Closed', 'Move to Spam']);
  });

  it('lists Move to New on a Spam request, so it can come back out', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu(quoteRequestDetail(ID, { status: 'spam', photos: [] }));

    await user.click(trigger());

    expect(itemNames()).toEqual(['Move to New', 'Move to Contacted', 'Move to Quoted', 'Move to Closed']);
  });

  it('is a menu button with no axe violations while open', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user, container } = renderMenu();

    await user.click(trigger());

    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(container);
  });
});

describe('the keyboard (APG menu button, as OrderStatusMenu)', () => {
  it('Enter opens on the first item, arrows wrap, Home and End jump, Esc closes and focuses the button', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu();
    trigger().focus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Move to Contacted' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Move to Quoted' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Move to Spam' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Move to Contacted' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Move to Spam' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Move to Contacted' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveFocus();
  });

  it('ArrowUp on the button opens on the last item', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu();
    trigger().focus();

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('menuitem', { name: 'Move to Spam' })).toHaveFocus();
  });

  it('Tab closes the menu and moves on from the button', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu();
    await user.click(trigger());

    await user.tab();

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });
});

describe('a move (D-15)', () => {
  it('sends the status, the version and an Idempotency-Key, toasts, puts focus on Change Status and tells the page', async () => {
    const backend = quoteRequestBackend(quoteRequestDetail(ID));
    const onMoved = vi.fn();
    const { user } = renderMenu(quoteRequestDetail(ID), { onMoved });
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Quoted' }));

    expect(await screen.findByText('Status changed')).toBeVisible();
    expect(screen.getByText('This request is now Quoted.')).toBeVisible();
    expect(backend.moves).toHaveLength(1);
    expect(backend.moves[0]?.body).toEqual({ status: 'quoted', version: 'AAAAAAAAB9E=' });
    expect(backend.moves[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(onMoved).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, status: 'quoted', version: 'AAAAAAAAB9I=' }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('shows Saving on the trigger, keeping focus, while the move runs', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    quoteRequestBackend(quoteRequestDetail(ID), async (body, id) => {
      await gate;
      return { id, status: body.status, statusChangedAtUtc: '2026-11-21T08:05:00Z', version: 'AAAAAAAAB9I=' };
    });
    const { user } = renderMenu();
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Contacted' }));

    const saving = await screen.findByRole('button', { name: 'Saving' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(saving).toHaveFocus();
    release();
    expect(await screen.findByRole('button', { name: 'Change Status' })).not.toHaveAttribute('aria-busy');
  });

  it('tells the page about a 409 instead of toasting', async () => {
    quoteRequestBackend(quoteRequestDetail(ID), () => quoteProblem(409, { code: 'quote-requests.conflict' }));
    const onConflict = vi.fn();
    const { user } = renderMenu(quoteRequestDetail(ID), { onConflict });
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Couldn't change the status")).toBeNull();
  });

  it("shows a refusal as a danger toast with the server's sentence", async () => {
    quoteRequestBackend(quoteRequestDetail(ID), () =>
      quoteProblem(400, { code: 'quote-requests.validation', detail: 'This request is already Quoted.' }),
    );
    const { user } = renderMenu();
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Quoted' }));

    expect(await screen.findByText("Couldn't change the status")).toBeVisible();
    expect(screen.getByText('This request is already Quoted.')).toBeVisible();
  });
});

describe('Move to Spam (D-04)', () => {
  it('asks first when photos remain, and Cancel changes nothing and returns focus to Change Status', async () => {
    const backend = quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu();
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));

    const dialog = await screen.findByRole('dialog', { name: 'Mark this request as spam?' });
    expect(dialog).toHaveTextContent(
      "Its 3 photos will be deleted within a day and can't be brought back. The request text stays until it's cleaned up after 6 months.",
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.moves).toHaveLength(0);
    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
  });

  it('tells the page about a 409 from the confirm only once the dialog has closed', async () => {
    quoteRequestBackend(quoteRequestDetail(ID), () => quoteProblem(409, { code: 'quote-requests.conflict' }));
    const openDialogs: number[] = [];
    const onConflict = vi.fn(() => {
      openDialogs.push(document.querySelectorAll('[role="dialog"][data-state="open"]').length);
    });
    const { user } = renderMenu(quoteRequestDetail(ID), { onConflict });
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark this request as spam?' });

    await user.click(within(dialog).getByRole('button', { name: 'Mark as Spam' }));

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledTimes(1);
    });
    expect(openDialogs).toEqual([0]);
  });

  it('Mark as Spam shows Marking while it runs, then moves and toasts', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const backend = quoteRequestBackend(quoteRequestDetail(ID), async (body, id) => {
      await gate;
      return { id, status: body.status, statusChangedAtUtc: '2026-11-21T08:05:00Z', version: 'AAAAAAAAB9I=' };
    });
    const onMoved = vi.fn();
    const { user } = renderMenu(quoteRequestDetail(ID), { onMoved });
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark this request as spam?' });

    await user.click(within(dialog).getByRole('button', { name: 'Mark as Spam' }));

    expect(await within(dialog).findByRole('button', { name: 'Marking' })).toHaveAttribute('aria-busy', 'true');
    release();
    expect(await screen.findByText('This request is now Spam.')).toBeVisible();
    expect(backend.moves[0]?.body).toEqual({ status: 'spam', version: 'AAAAAAAAB9E=' });
    expect(onMoved).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
  });

  it('says "Its 1 photo" for one photo', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const one = quoteRequestDetail(ID, { photos: quoteRequestDetail(ID).photos.slice(0, 1), photoCount: 1 });
    const { user } = renderMenu(one);
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      "Its 1 photo will be deleted within a day and can't be brought back.",
    );
  });

  it('acts at once without photos', async () => {
    const backend = quoteRequestBackend(quoteRequestDetail(ID));
    const { user } = renderMenu(quoteRequestDetail(ID, { photos: [], photoCount: 0 }));
    await user.click(trigger());

    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));

    expect(await screen.findByText('This request is now Spam.')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(backend.moves).toHaveLength(1);
  });
});
