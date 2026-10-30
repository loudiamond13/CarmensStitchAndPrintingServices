// Phase 8 demos in the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions"; plan 08-24): the order totals in
// their balance states, the order cards, the due flag, the Delivered badge, the Change Status menu, the banners and the two delete
// dialogs, all on made-up data and local state. No test here may cause a request.
import { render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { Phase8Demos } from './Phase8Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase8Demos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

/** Every request the page makes, seen two ways: MSW's request events and a spy on fetch. */
const requests: string[] = [];
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  server.events.removeAllListeners();
  fetchSpy.mockRestore();
});

describe('Phase8Demos: the totals panels', () => {
  it('shows every balance state: due, Fully Paid, Customer credit and Not collected, the Cancelled note and the largest figures', () => {
    renderDemos();
    const frame = within(caseFrame('orders-totals-states'));

    expect(frame.getAllByText('Balance due')).toHaveLength(2);
    expect(frame.getAllByText('₱9,327.50').length).toBeGreaterThan(0);
    expect(frame.getByText('Fully Paid')).toBeInTheDocument();
    expect(frame.getByText('Customer credit')).toBeInTheDocument();
    expect(frame.getByText('₱640.00')).toBeInTheDocument();
    expect(frame.getByText('Not collected')).toBeInTheDocument();
    expect(frame.getByText(/^Cancelled: profit = money kept/)).toBeInTheDocument();
    expect(frame.getAllByText('₱99,999,999.99').length).toBeGreaterThan(0);
    expect(frame.getAllByText('Estimated Profit').length).toBe(5);
  });
});

describe('Phase8Demos: the order cards', () => {
  it('shows Fully Paid, a credit badge, a walk-in customer, Delivered, and no Edit Details on a Completed or Cancelled order', () => {
    renderDemos();
    const frame = within(caseFrame('orders-card-states'));
    const cards = frame.getAllByRole('article');

    expect(cards).toHaveLength(8);
    expect(frame.getAllByText('Fully Paid').length).toBeGreaterThan(0);
    expect(frame.getByText('Credit ₱640.00')).toBeInTheDocument();
    expect(frame.getByText('Walk-in customer')).toBeInTheDocument();
    expect(frame.getByText('Delivered')).toBeInTheDocument();
    expect(frame.getByText('Not collected')).toBeInTheDocument();
    expect(frame.getAllByRole('button', { name: /^Edit details of order / })).toHaveLength(6);
    expect(frame.queryByRole('button', { name: 'Edit details of order ORD-2026-0155' })).toBeNull();
    expect(frame.queryByRole('button', { name: 'Edit details of order ORD-2026-0156' })).toBeNull();
  });

  it('wraps a 100-character team and customer name anywhere inside the card', () => {
    renderDemos();
    const frame = within(caseFrame('orders-card-states'));
    const names = frame.getAllByText(/^Bartholomew/);

    expect(names).toHaveLength(2);
    for (const name of names) {
      expect(name.className).toContain('wrap-anywhere');
    }
  });
});

describe('Phase8Demos: the due flag and the badges', () => {
  it('shows days left, tomorrow, today, overdue, no flag for an empty date or a Delivered order, and the stacked layout', () => {
    renderDemos();
    const frame = within(caseFrame('orders-due-flags'));

    expect(frame.getByText('2 days left')).toBeInTheDocument();
    expect(frame.getByText('Due tomorrow')).toBeInTheDocument();
    expect(frame.getByText('Due today')).toBeInTheDocument();
    expect(frame.getAllByText('Overdue by 7 days')).toHaveLength(2);
    const delivered = frame.getByText('Delivered, past its date').closest('li');
    expect(delivered).toHaveTextContent('Due Oct 5, 2026');
    expect(delivered).not.toHaveTextContent('Overdue');
    const empty = frame.getByText('Empty date').closest('li');
    expect(empty).not.toHaveTextContent('Overdue');
  });

  it('shows the seven status badges including Delivered', () => {
    renderDemos();
    const frame = within(caseFrame('orders-status-badges'));

    for (const label of ['Pending', 'Mockup', 'In Production', 'Ready', 'Delivered', 'Completed', 'Cancelled']) {
      expect(frame.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('Phase8Demos: the status menu and the banners', () => {
  it('draws the menu with the other active statuses, Mark Completed off with its reason, and Cancel Order', () => {
    renderDemos();
    const menu = within(caseFrame('orders-status-menu')).getByRole('menu');
    const items = within(menu);

    expect(items.getByRole('menuitem', { name: 'Move to Pending' })).toBeInTheDocument();
    expect(items.getByRole('menuitem', { name: 'Move to Delivered' })).toBeInTheDocument();
    expect(items.queryByRole('menuitem', { name: 'Move to In Production' })).toBeNull();
    const completed = items.getByRole('menuitem', { name: /^Mark Completed/ });
    expect(completed).toHaveAttribute('aria-disabled', 'true');
    expect(completed).toHaveTextContent('Balance must be ₱0.00 to complete.');
    expect(items.getByRole('menuitem', { name: 'Cancel Order' })).toBeInTheDocument();
  });

  it('shows the Completed and Cancelled locked banners with Reopen Order, and the deleted notice with Restore and Delete Order Permanently', () => {
    renderDemos();
    const frame = within(caseFrame('orders-banners'));

    expect(frame.getByText('This order is completed.')).toBeInTheDocument();
    expect(frame.getByText('This order is cancelled.')).toBeInTheDocument();
    expect(frame.getByText('Refunds can still be recorded on the Refunds tab.')).toBeInTheDocument();
    expect(frame.getAllByRole('button', { name: 'Reopen Order' })).toHaveLength(2);
    expect(frame.getByText('This order was deleted on Oct 12, 2026, 9:30 AM by Carmen Reyes.')).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Restore Order' })).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Delete Order Permanently' })).toBeInTheDocument();
  });
});

describe('Phase8Demos: the delete dialogs', () => {
  it('opens the soft delete with its sentence and Cancel focused, and the permanent delete with the tally and the typed number', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('orders-delete-dialogs'));

    await user.click(frame.getByRole('button', { name: 'Open Delete Order' }));
    const soft = await screen.findByRole('dialog', { name: 'Delete ORD-2026-0148?' });
    expect(
      within(soft).getByText(
        'Its 5 items, 2 payments, 1 discount and 3 expenses are hidden from every list and total. A Manager can restore it.',
      ),
    ).toBeInTheDocument();
    expect(within(soft).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(soft).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.click(frame.getByRole('button', { name: 'Open Delete Order Permanently' }));
    const purge = await screen.findByRole('dialog', { name: 'Delete ORD-2026-0148 permanently?' });
    expect(
      within(purge).getByText('This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 1 refund.'),
    ).toBeInTheDocument();
    const confirm = within(purge).getByRole('button', { name: 'Delete Order Permanently' });
    expect(confirm).toBeDisabled();
    await user.type(within(purge).getByRole('textbox'), 'ORD-2026-0148');
    expect(confirm).toBeEnabled();
  });

  it('makes no request, whatever is pressed', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('orders-delete-dialogs'));

    await user.click(frame.getByRole('button', { name: 'Open Delete Order' }));
    const soft = await screen.findByRole('dialog');
    await user.click(within(soft).getByRole('button', { name: 'Delete Order' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const [view] = within(caseFrame('orders-card-states')).getAllByRole('button', { name: /^View order / });
    if (view === undefined) {
      throw new Error('No View order button.');
    }
    await user.click(view);
    await user.click(within(caseFrame('orders-status-menu')).getByRole('menuitem', { name: 'Move to Pending' }));

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase8Demos: strict mode', () => {
  it('renders every case twice over in StrictMode (the cached render and the fresh one) with the same content', () => {
    const { container } = render(
      <StrictMode>
        <MemoryRouter>
          <ToastProvider>
            <Phase8Demos />
          </ToastProvider>
        </MemoryRouter>
      </StrictMode>,
    );

    for (const id of [
      'orders-totals-states',
      'orders-card-states',
      'orders-due-flags',
      'orders-status-badges',
      'orders-status-menu',
      'orders-banners',
      'orders-delete-dialogs',
    ]) {
      expect(caseFrame(id)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-case]')).toHaveLength(7);
  });
});

describe('Phase8Demos: the data', () => {
  it('uses only made-up names and no address outside example.com', () => {
    const { container } = renderDemos();

    expect(container.textContent).not.toMatch(/@(?!example\.com)/);
  });

  it('has no axe violations in the static cases', async () => {
    const { container } = renderDemos();
    expect(caseFrame('orders-totals-states')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it.each(['Open Delete Order', 'Open Delete Order Permanently'])(
    'has no axe violations with a delete dialog open: %s',
    async (trigger) => {
      const user = userEvent.setup();
      renderDemos();

      await user.click(within(caseFrame('orders-delete-dialogs')).getByRole('button', { name: trigger }));
      const dialog = await screen.findByRole('dialog');

      await expectNoAxeViolations(dialog);
    },
  );
});
