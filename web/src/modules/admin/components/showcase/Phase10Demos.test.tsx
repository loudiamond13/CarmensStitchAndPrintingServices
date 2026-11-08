// Phase 10 demos in the Component Showcase (UI-SPEC "Component Showcase additions" and "Visual Review"; plan 10-21): the dashboard cards,
// the money strip, the ledger, All Staff, the Transfers table, the Transfer and Hand Over windows and the two transfer dialogs, all on
// made-up people and figures. No test here may cause a request: the demos hold their own data and send nothing.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { Phase10Demos } from './Phase10Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase10Demos />
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

/** Every case of the section, in the order the page shows them. */
const CASE_IDS = [
  'dashboard-d1-demo',
  'dashboard-new-shop',
  'dashboard-cards-loading',
  'dashboard-cards-error',
  'dashboard-chart-6m',
  'dashboard-chart-12m',
  'dashboard-orders-by-status',
  'dashboard-recent-orders',
  'money-strip-negative',
  'money-strip-states',
  'money-on-hand-states',
  'money-ledger-kinds',
  'money-ledger-states',
  'money-all-staff',
  'money-transfers-table',
  'money-transfer-window',
  'money-hand-over-window',
  'money-delete-transfer-dialog',
  'money-remove-transfer-dialog',
];

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

describe('Phase10Demos: the dashboard cards', () => {
  it('shows D1 with the demo values: four KPIs, a 6-month chart with the profit line, six status rows and 6 recent orders', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-d1-demo'));

    expect(frame.getByText('Active orders')).toBeInTheDocument();
    expect(frame.getByText('Total receivables')).toBeInTheDocument();
    expect(frame.getByText('Collected · Oct')).toBeInTheDocument();
    expect(frame.getByText('Company expenses · Oct')).toBeInTheDocument();
    expect(frame.getByText('₱84,260.00')).toBeInTheDocument();
    expect(frame.getByText('₱126,450.00')).toBeInTheDocument();
    expect(frame.getByText('₱38,226.95')).toBeInTheDocument();
    expect(frame.getByRole('heading', { name: 'Income vs. expenses' })).toBeInTheDocument();
    expect(frame.getByText('Profit (income minus expenses)')).toBeInTheDocument();
    expect(frame.getAllByRole('img', { name: /income/i })).toHaveLength(6);
    const statuses = within(frame.getByRole('heading', { name: 'Orders by status' }).closest('section') ?? document.body);
    expect(statuses.getAllByRole('listitem')).toHaveLength(6);
    const recent = frame.getByRole('table', { name: 'Recent orders' });
    expect(within(recent).getAllByRole('row')).toHaveLength(7);
  });

  it('shows a new shop at zero: zero KPIs, no chart, no open orders and no recent orders', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-new-shop'));

    expect(frame.getByText('No money in or out yet')).toBeInTheDocument();
    expect(frame.getByText('No open orders')).toBeInTheDocument();
    expect(frame.getByText('No orders yet')).toBeInTheDocument();
    expect(frame.getByText('No expenses yet this month')).toBeInTheDocument();
    expect(frame.getAllByText('₱0.00').length).toBeGreaterThanOrEqual(3);
  });

  it('shows every dashboard card loading, each with its own status', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-cards-loading'));

    for (const things of ['the shop figures', 'order counts', 'recent orders', 'the chart']) {
      expect(frame.getAllByText(new RegExp(`Loading ${things}`)).length).toBeGreaterThan(0);
    }
  });

  it('shows every dashboard card failed, each with Try Again', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-cards-error'));

    for (const things of ['the shop figures', 'order counts', 'recent orders', 'the chart']) {
      expect(frame.getAllByText(new RegExp(`Couldn't load ${things}`)).length).toBeGreaterThan(0);
    }
    expect(frame.getAllByRole('button', { name: 'Try Again' }).length).toBeGreaterThanOrEqual(4);
  });

  it('draws the chart at 6M with a negative-profit month, and at 12M with a negative-income month', () => {
    renderDemos();
    const six = within(caseFrame('dashboard-chart-6m'));
    const twelve = within(caseFrame('dashboard-chart-12m'));

    expect(six.getAllByRole('img', { name: /income/i })).toHaveLength(6);
    expect(six.getByRole('img', { name: /Jul 2026.*profit −₱19,500\.00/i })).toBeInTheDocument();
    expect(twelve.getAllByRole('img', { name: /income/i })).toHaveLength(12);
    expect(twelve.getByRole('img', { name: /Jan 2026.*income −₱1,500\.00/i })).toBeInTheDocument();
    expect(six.getByRole('radio', { name: '6M' })).toBeChecked();
    expect(twelve.getByRole('radio', { name: '12M' })).toBeChecked();
  });

  it('shows Orders by status with one large count and several zero counts', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-orders-by-status'));

    expect(frame.getAllByRole('listitem')).toHaveLength(6);
    expect(frame.getByText('48')).toBeInTheDocument();
    expect(frame.getAllByText('0').length).toBeGreaterThanOrEqual(3);
  });

  it('shows Recent orders with due, overdue, Fully Paid, credit and Not collected rows', () => {
    renderDemos();
    const frame = within(caseFrame('dashboard-recent-orders'));

    expect(frame.getAllByRole('row')).toHaveLength(7);
    expect(frame.getByText('Fully Paid')).toBeInTheDocument();
    expect(frame.getByText('Not collected')).toBeInTheDocument();
    expect(frame.getByText(/Credit/)).toBeInTheDocument();
    expect(frame.getByText(/overdue/i)).toBeInTheDocument();
    expect(frame.getByText(/Due in|due in/)).toBeInTheDocument();
  });
});

describe('Phase10Demos: the money strip and the My Money card', () => {
  it('shows a negative money strip in the danger tone with the true minus sign', () => {
    renderDemos();
    const frame = within(caseFrame('money-strip-negative'));

    expect(frame.getByText('Your money on hand')).toBeInTheDocument();
    expect(frame.getByText('−₱500.00')).toBeInTheDocument();
    expect(frame.getByRole('link', { name: 'View Ledger' })).toBeInTheDocument();
  });

  it('shows the strip at zero with its reason, loading, and failed with Try Again', () => {
    renderDemos();
    const frame = within(caseFrame('money-strip-states'));

    expect(frame.getByText('₱0.00')).toBeInTheDocument();
    expect(frame.getByText('Nothing on hand to transfer.')).toBeInTheDocument();
    expect(frame.getAllByText(/Loading your money/).length).toBeGreaterThan(0);
    expect(frame.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows the My Money card with a figure, below zero, at zero, loading and failed', () => {
    renderDemos();
    const frame = within(caseFrame('money-on-hand-states'));

    expect(frame.getAllByText('Money on hand')).toHaveLength(5);
    expect(frame.getByText('₱8,450.00')).toBeInTheDocument();
    expect(frame.getByText('−₱500.00')).toBeInTheDocument();
    expect(frame.getByText('₱0.00')).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });
});

describe('Phase10Demos: the ledger, All Staff and the Transfers table', () => {
  it('shows the ledger with every kind of row, a hand-over, a negative running balance and a deleted row', () => {
    renderDemos();
    const table = within(within(caseFrame('money-ledger-kinds')).getByRole('table', { name: 'Ledger' }));

    expect(table.getAllByRole('row')).toHaveLength(8);
    expect(table.getByText('Payment received')).toBeInTheDocument();
    expect(table.getByText('Refund handed back')).toBeInTheDocument();
    expect(table.getByText('Transfer in')).toBeInTheDocument();
    expect(table.getAllByText('Transfer out').length).toBeGreaterThan(0);
    expect(table.getByText('Company expense')).toBeInTheDocument();
    expect(table.getByText('Order expense')).toBeInTheDocument();
    expect(table.getByText('Hand-over')).toBeInTheDocument();
    expect(table.getAllByText('−₱500.00').length).toBeGreaterThan(0);
    expect(table.getByText('Deleted')).toBeInTheDocument();
  });

  it('shows the ledger loading, empty and failed', () => {
    renderDemos();
    const frame = within(caseFrame('money-ledger-states'));

    expect(frame.getAllByText(/Loading the ledger/).length).toBeGreaterThan(0);
    expect(frame.getByText('No money moves yet')).toBeInTheDocument();
    expect(frame.getByText(/Couldn't load the ledger/)).toBeInTheDocument();
  });

  it('shows All Staff with a negative active person, a deactivated person holding money and a deleted person owed money', () => {
    renderDemos();
    const table = within(within(caseFrame('money-all-staff')).getByRole('table', { name: 'All Staff' }));

    expect(table.getByText('Liza Mercado')).toBeInTheDocument();
    expect(table.getAllByText('−₱500.00').length).toBeGreaterThan(0);
    expect(table.getByText('Jomar Santos')).toBeInTheDocument();
    expect(table.getByText('Deactivated')).toBeInTheDocument();
    expect(table.getByRole('button', { name: 'Hand over money from Jomar Santos' })).toBeInTheDocument();
    expect(table.getByText('Ana Villanueva')).toBeInTheDocument();
    expect(table.getByText('Deleted')).toBeInTheDocument();
    expect(table.getByText('−₱300.00')).toBeInTheDocument();
    expect(table.queryByRole('button', { name: 'Hand over money from Ana Villanueva' })).toBeNull();
  });

  it('shows the Transfers table with a counted and a deleted transfer', () => {
    renderDemos();
    const table = within(within(caseFrame('money-transfers-table')).getByRole('table', { name: 'Transfers' }));

    expect(table.getAllByRole('row')).toHaveLength(3);
    expect(table.getByText('Deleted')).toBeInTheDocument();
    expect(table.getByRole('button', { name: /^Delete transfer of/ })).toBeInTheDocument();
    expect(table.getByRole('button', { name: /^Remove .*permanently/i })).toBeInTheDocument();
  });
});

describe('Phase10Demos: the windows and the dialogs', () => {
  it('opens Transfer Money, shows its validation messages on an empty save, and closes with Cancel', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('money-transfer-window')).getByRole('button', { name: 'Open Transfer Money' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transfer Money' });
    await user.click(within(dialog).getByRole('button', { name: 'Record Transfer' }));

    expect(await within(dialog).findByText('Choose who got the cash.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the amount.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('opens Transfer Money and shows the server refusal under Amount, with the typed values kept', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('money-transfer-window')).getByRole('button', { name: 'Open Transfer Money (server refuses)' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Transfer Money' });
    await user.selectOptions(within(dialog).getByLabelText(/^To/), 'Paolo Garcia');
    await user.type(within(dialog).getByLabelText(/^Amount/), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Record Transfer' }));

    expect(await within(dialog).findByText('You only have ₱200.00 on hand.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Amount/)).toHaveValue('1,000.00');
  });

  it('opens Hand Over Money for a leaver with its note, and shows its server refusal', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('money-hand-over-window')).getByRole('button', { name: 'Open Hand Over Money (server refuses)' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Hand Over Money' });
    expect(within(dialog).getByText('From Jomar Santos (deactivated). They hold ₱2,000.00.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/^To/), 'Carmen Reyes (you)');
    await user.type(within(dialog).getByLabelText(/^Amount/), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Hand Over' }));

    expect(await within(dialog).findByText('Jomar Santos holds only ₱1,500.00.')).toBeInTheDocument();
  });

  it('opens Delete Transfer with the resulting-balance warning, and without it', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('money-delete-transfer-dialog'));

    await user.click(frame.getByRole('button', { name: 'Open Delete Transfer (with warning)' }));
    let dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/balance will be −₱500\.00/);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.click(frame.getByRole('button', { name: 'Open Delete Transfer' }));
    dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('opens Remove Permanently with its danger details box and Cancel focused', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('money-remove-transfer-dialog')).getByRole('button', { name: 'Open Remove Permanently' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('makes no request, whatever is pressed (no fetch)', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('money-delete-transfer-dialog')).getByRole('button', { name: 'Open Delete Transfer' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(
      within(caseFrame('money-remove-transfer-dialog')).getByRole('button', { name: 'Open Remove Permanently' }),
    );
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(within(caseFrame('money-transfer-window')).getByRole('button', { name: 'Open Transfer Money' }));
    dialog = await screen.findByRole('dialog', { name: 'Transfer Money' });
    await user.selectOptions(within(dialog).getByLabelText(/^To/), 'Paolo Garcia');
    await user.type(within(dialog).getByLabelText(/^Amount/), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Record Transfer' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    // Strip, tables and cards: a press on any of them does nothing.
    await user.click(within(caseFrame('money-strip-negative')).getByRole('button', { name: 'Transfer' }));
    await user.click(within(caseFrame('money-all-staff')).getByRole('button', { name: 'Hand over money from Jomar Santos' }));
    fireEvent.click(within(caseFrame('dashboard-cards-error')).getAllByRole('button', { name: 'Try Again' })[0] as HTMLElement);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase10Demos: strict mode and the data', () => {
  it('renders every case in StrictMode', () => {
    const { container } = render(
      <StrictMode>
        <MemoryRouter>
          <ToastProvider>
            <Phase10Demos />
          </ToastProvider>
        </MemoryRouter>
      </StrictMode>,
    );

    for (const id of CASE_IDS) {
      expect(caseFrame(id)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-case]')).toHaveLength(CASE_IDS.length);
  });

  it('names no outside address and no real mailbox', () => {
    const { container } = renderDemos();

    expect(container.textContent).not.toMatch(/@(?!example\.com)/);
    const addresses = [...container.querySelectorAll('[src], [srcset], [href]')].flatMap((element) =>
      ['src', 'srcset', 'href'].map((name) => element.getAttribute(name) ?? ''),
    );
    expect(addresses.filter((address) => /^https?:\/\//.test(address))).toEqual([]);
  });

  // The whole section is about 18 frames with several tables, so axe gets a longer budget than the 5 s default.
  it('has no axe violations in the static cases', async () => {
    const { container } = renderDemos();
    expect(caseFrame('dashboard-d1-demo')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  }, 60_000);

  it.each([
    ['money-transfer-window', 'Open Transfer Money'],
    ['money-hand-over-window', 'Open Hand Over Money'],
    ['money-delete-transfer-dialog', 'Open Delete Transfer (with warning)'],
    ['money-remove-transfer-dialog', 'Open Remove Permanently'],
  ])('has no axe violations with a live case open: %s, %s', async (id, trigger) => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame(id)).getByRole('button', { name: trigger }));
    const dialog = await screen.findByRole('dialog');

    await expectNoAxeViolations(dialog);
  });
});
