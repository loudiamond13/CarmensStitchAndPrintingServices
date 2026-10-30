import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { categoriesBackend, categoryItem, OTHERS_ID, problemResponse } from '@/test/expenseFixtures';
import type { ListKey } from '@/modules/admin/components/ListEntrySelect';
import { LIST_SETTINGS } from '@/modules/admin/listSettingsConfigs';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  codedProblem,
  createEntryBackend,
  deleteEntryBackend,
  entryDetail,
  entryDetailBackend,
  listBackend,
  listItem,
  reactivateEntryBackend,
  retireEntryBackend,
  updateEntryBackend,
  type OrderListItemFixture,
  type OrderListRoute,
} from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { ListSettingsSection } from './ListSettingsSection';

// S1 list card for the three order lists (D-31, D-32; plan 08-08): the Phase 6 category card with each list's own words.

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

interface ListCase {
  list: OrderListRoute;
  heading: string;
  hint: string;
  add: string;
  save: string;
  addTitle: string;
  editTitle: string;
  tableName: string;
  firstColumn: string;
  countColumn: string;
  caption: string;
  addedTitle: string;
  updatedTitle: string;
  deletedTitle: string;
  retiredTitle: string;
  retiredMessage: (name: string) => string;
  backTitle: string;
  backMessage: (name: string) => string;
  deleteTitle: (name: string) => string;
  deleteMessage: string;
  deleteConfirm: string;
  inUseTitle: (name: string) => string;
  inUseBody: string;
  /** An active entry in use, an active one never used, and a retired one that was never used. */
  rows: readonly [OrderListItemFixture, OrderListItemFixture, OrderListItemFixture];
}

const CASES: readonly ListCase[] = [
  {
    list: 'product-types',
    heading: 'Product Types',
    hint: 'Staff pick one of these for each order item.',
    add: 'Add Product Type',
    save: 'Save Product Type',
    addTitle: 'Add Product Type',
    editTitle: 'Edit Product Type',
    tableName: 'Product types',
    firstColumn: 'Product type',
    countColumn: 'Items',
    caption:
      'Retired product types are hidden from the item form, but past items keep them and the Orders filter still shows them. A product type no item has ever used, deleted orders included, can be deleted.',
    addedTitle: 'Product type added',
    updatedTitle: 'Product type updated',
    deletedTitle: 'Product type deleted',
    retiredTitle: 'Product type retired',
    retiredMessage: (name) => `${name} no longer shows in the item form. Past items keep it.`,
    backTitle: 'Product type back in use',
    backMessage: (name) => `${name} shows in the item form again.`,
    deleteTitle: (name) => `Delete the ${name} product type?`,
    deleteMessage: "No order item has ever used it, so it can be deleted. This can't be undone.",
    deleteConfirm: 'Delete Product Type',
    inUseTitle: (name) => `${name} is now used by an order item, so it can't be deleted.`,
    inUseBody: 'Retire it instead to hide it from the item form.',
    rows: [
      listItem('11111111-0000-4000-8000-000000000001', 'Basketball Jersey', 'accent', { useCount: 12 }),
      listItem('11111111-0000-4000-8000-000000000002', 'Cycling Jersey', 'info'),
      listItem('11111111-0000-4000-8000-000000000003', 'Old Style Jersey', 'neutral', { status: 'retired' }),
    ],
  },
  {
    list: 'payment-methods',
    heading: 'Payment Methods',
    hint: 'Staff pick one of these when they record a payment.',
    add: 'Add Payment Method',
    save: 'Save Payment Method',
    addTitle: 'Add Payment Method',
    editTitle: 'Edit Payment Method',
    tableName: 'Payment methods',
    firstColumn: 'Payment method',
    countColumn: 'Payments',
    caption:
      'Retired payment methods are hidden from the payment form, but past payments keep them. A payment method no payment has ever used, deleted orders included, can be deleted.',
    addedTitle: 'Payment method added',
    updatedTitle: 'Payment method updated',
    deletedTitle: 'Payment method deleted',
    retiredTitle: 'Payment method retired',
    retiredMessage: (name) => `${name} no longer shows in the payment form. Past payments keep it.`,
    backTitle: 'Payment method back in use',
    backMessage: (name) => `${name} shows in the payment form again.`,
    deleteTitle: (name) => `Delete the ${name} payment method?`,
    deleteMessage: "No payment has ever used it, so it can be deleted. This can't be undone.",
    deleteConfirm: 'Delete Payment Method',
    inUseTitle: (name) => `${name} is now used by a payment, so it can't be deleted.`,
    inUseBody: 'Retire it instead to hide it from the payment form.',
    rows: [
      listItem('22222222-0000-4000-8000-000000000001', 'Cash', 'success', { useCount: 40 }),
      listItem('22222222-0000-4000-8000-000000000002', 'GCash', 'info'),
      listItem('22222222-0000-4000-8000-000000000003', 'Bank Transfer', 'neutral', { status: 'retired' }),
    ],
  },
  {
    list: 'order-expense-categories',
    heading: 'Order Expense Categories',
    hint: 'Staff pick one of these when they record a cost for an order.',
    add: 'Add Category',
    save: 'Save Category',
    addTitle: 'Add Category',
    editTitle: 'Edit Category',
    tableName: 'Order expense categories',
    firstColumn: 'Category',
    countColumn: 'Expenses',
    caption:
      'Retired categories are hidden from the order expense form, but past expenses keep them. A category no order expense has ever used, deleted orders included, can be deleted.',
    addedTitle: 'Category added',
    updatedTitle: 'Category updated',
    deletedTitle: 'Category deleted',
    retiredTitle: 'Category retired',
    retiredMessage: (name) => `${name} no longer shows in the order expense form. Past expenses keep it.`,
    backTitle: 'Category back in use',
    backMessage: (name) => `${name} shows in the order expense form again.`,
    deleteTitle: (name) => `Delete the ${name} category?`,
    deleteMessage: "No order expense has ever used it, so it can be deleted. This can't be undone.",
    deleteConfirm: 'Delete Category',
    inUseTitle: (name) => `${name} is now used by an order expense, so it can't be deleted.`,
    inUseBody: 'Retire it instead to hide it from the order expense form.',
    rows: [
      listItem('33333333-0000-4000-8000-000000000001', 'Fabric', 'warning', { useCount: 6 }),
      listItem('33333333-0000-4000-8000-000000000002', 'Labor', 'mockup'),
      listItem('33333333-0000-4000-8000-000000000003', 'Printing Supplies', 'neutral', { status: 'retired' }),
    ],
  },
];

function renderSection(list: ListKey) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <ListSettingsSection config={LIST_SETTINGS[list]} />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function rowOf(name: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(name) !== null);
  if (row === undefined) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

function cellOf(row: HTMLElement, label: string): HTMLElement {
  const cell = row.querySelector<HTMLElement>(`td[data-label="${label}"]`);
  if (cell === null) {
    throw new Error(`No ${label} cell`);
  }
  return cell;
}

function titlesIn(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole('button')
    .map((button) => button.getAttribute('title'));
}

/** A list the fake server edits as the calls arrive. */
function liveList(route: OrderListRoute, initial: readonly OrderListItemFixture[]) {
  const state = new Map(initial.map((entry) => [entry.id, { ...entry }]));
  listBackend(route, () => [...state.values()]);
  return state;
}

describe.each(CASES)('S1 list card: $list', (c) => {
  const [used, unused, retired] = c.rows;

  async function open(rows: readonly OrderListItemFixture[] = c.rows) {
    const state = liveList(c.list, rows);
    const view = renderSection(c.list);
    await screen.findByRole('table', { name: c.tableName });
    return { view, state };
  }

  it('shows the card heading, hint, Add button, table columns and caption in the list words', async () => {
    await open();

    expect(screen.getByRole('heading', { level: 2, name: c.heading })).toBeVisible();
    expect(screen.getByText(c.hint)).toBeVisible();
    expect(screen.getByRole('button', { name: c.add })).toBeVisible();
    expect(
      within(screen.getByRole('table', { name: c.tableName }))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([c.firstColumn, 'Status', c.countColumn, 'Actions']);
    expect(screen.getByText(c.caption)).toBeVisible();
  });

  it('shows each entry as a badge with its status and use count', async () => {
    await open();

    expect(within(cellOf(rowOf(used.name), 'Status')).getByText('Active')).toBeVisible();
    expect(within(cellOf(rowOf(retired.name), 'Status')).getByText('Retired')).toBeVisible();
    expect(cellOf(rowOf(used.name), c.countColumn)).toHaveTextContent(String(used.useCount));
    expect(cellOf(rowOf(unused.name), c.countColumn)).toHaveTextContent('0');
  });

  it('offers Delete only for an entry nothing has used', async () => {
    await open();

    expect(titlesIn(rowOf(used.name))).toEqual([`Edit ${used.name}`, `Retire ${used.name}`]);
    expect(titlesIn(rowOf(unused.name))).toEqual([
      `Edit ${unused.name}`,
      `Retire ${unused.name}`,
      `Delete ${unused.name}`,
    ]);
    expect(titlesIn(rowOf(retired.name))).toEqual([
      `Edit ${retired.name}`,
      `Use ${retired.name} again`,
      `Delete ${retired.name}`,
    ]);
  });

  it('adds an entry: posts to its route with an Idempotency-Key, toasts, reads the lists again and returns focus', async () => {
    const sent = createEntryBackend(c.list);
    const user = userEvent.setup();
    await open();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const add = screen.getByRole('button', { name: c.add });

    await user.click(add);
    const dialog = screen.getByRole('dialog', { name: c.addTitle });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Hoodie');
    await user.click(within(dialog).getByRole('radio', { name: 'Blue' }));
    await user.click(within(dialog).getByRole('button', { name: c.save }));

    expect(await screen.findByText(c.addedTitle)).toBeVisible();
    expect(screen.getByText('Hoodie is ready to use.')).toBeVisible();
    expect(sent.bodies).toEqual([{ name: 'Hoodie', tone: 'info' }]);
    expect(sent.keys[0]).toMatch(/\S+/);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(add).toHaveFocus();
    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(keys).toEqual(expect.arrayContaining([JSON.stringify([c.list]), JSON.stringify(['orders'])]));
  });

  it('edits an entry: sends the row version, toasts the new name and returns focus to the row Edit button', async () => {
    entryDetailBackend(c.list, entryDetail({ id: used.id, name: used.name, tone: used.tone, version: 'AAAAAAAAB9E=' }));
    const sent = updateEntryBackend(c.list, () => Response.json(entryDetail({ id: used.id, name: 'Renamed entry' })));
    const user = userEvent.setup();
    await open();
    const edit = within(rowOf(used.name)).getByRole('button', { name: `Edit ${used.name}` });

    await user.click(edit);
    const dialog = screen.getByRole('dialog', { name: c.editTitle });
    const name = await within(dialog).findByDisplayValue(used.name);
    await user.clear(name);
    await user.type(name, 'Renamed entry');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText(c.updatedTitle)).toBeVisible();
    expect(sent.ids).toEqual([used.id]);
    expect(sent.bodies).toEqual([{ name: 'Renamed entry', tone: used.tone, version: 'AAAAAAAAB9E=' }]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(edit).toHaveFocus();
  });

  it('retires at once with the per-list toast, flips the row and keeps focus on the flipped action', async () => {
    const user = userEvent.setup();
    const { state } = await open();
    const sent = retireEntryBackend(c.list, (id) => {
      const entry = state.get(id);
      if (entry !== undefined) {
        entry.status = 'retired';
      }
      return new Response(null, { status: 204 });
    });

    await user.click(within(rowOf(unused.name)).getByRole('button', { name: `Retire ${unused.name}` }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(within(cellOf(rowOf(unused.name), 'Status')).getByText('Retired')).toBeVisible();
    });
    expect(sent.ids).toEqual([unused.id]);
    expect(sent.keys[0]).toMatch(/\S+/);
    expect(await screen.findByText(c.retiredTitle)).toBeVisible();
    expect(screen.getByText(c.retiredMessage(unused.name))).toBeVisible();
    expect(within(rowOf(unused.name)).getByRole('button', { name: `Use ${unused.name} again` })).toHaveFocus();
  });

  it('brings an entry back with the per-list toast', async () => {
    const user = userEvent.setup();
    const { state } = await open();
    const sent = reactivateEntryBackend(c.list, (id) => {
      const entry = state.get(id);
      if (entry !== undefined) {
        entry.status = 'active';
      }
      return new Response(null, { status: 204 });
    });

    await user.click(within(rowOf(retired.name)).getByRole('button', { name: `Use ${retired.name} again` }));

    await waitFor(() => {
      expect(within(cellOf(rowOf(retired.name), 'Status')).getByText('Active')).toBeVisible();
    });
    expect(sent.ids).toEqual([retired.id]);
    expect(await screen.findByText(c.backTitle)).toBeVisible();
    expect(screen.getByText(c.backMessage(retired.name))).toBeVisible();
  });

  it('deletes a never-used entry after a confirmation in the list words', async () => {
    const user = userEvent.setup();
    const { state } = await open();
    const sent = deleteEntryBackend(c.list, (id) => {
      state.delete(id);
      return new Response(null, { status: 204 });
    });

    await user.click(within(rowOf(unused.name)).getByRole('button', { name: `Delete ${unused.name}` }));
    const dialog = await screen.findByRole('dialog', { name: c.deleteTitle(unused.name) });
    expect(within(dialog).getByText(c.deleteMessage)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: c.deleteConfirm }));

    expect(await screen.findByText(c.deletedTitle)).toBeVisible();
    expect(sent.ids).toEqual([unused.id]);
    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText(unused.name)).toBeNull();
    });
  });

  it('answers a delete the server refuses because a record started using the entry', async () => {
    const user = userEvent.setup();
    await open();
    deleteEntryBackend(c.list, () => codedProblem(422, `${c.list}.in-use`));

    await user.click(within(rowOf(unused.name)).getByRole('button', { name: `Delete ${unused.name}` }));
    const dialog = await screen.findByRole('dialog', { name: c.deleteTitle(unused.name) });
    await user.click(within(dialog).getByRole('button', { name: c.deleteConfirm }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(`${c.inUseTitle(unused.name)} ${c.inUseBody}`);
  });

  it('has no axe violations with rows', async () => {
    const { view } = await open();

    await expectNoAxeViolations(view.container);
  });
});

// Others, the empty list and the list states on every tab (UIC-18, UIC-41, UIC-72, UIC-73; plan 08-08).
const STATES: readonly {
  list: ListKey;
  route: OrderListRoute | null;
  heading: string;
  tableName: string;
  things: string;
}[] = [
  { list: 'product-types', route: 'product-types', heading: 'Product Types', tableName: 'Product types', things: 'product types' },
  {
    list: 'payment-methods',
    route: 'payment-methods',
    heading: 'Payment Methods',
    tableName: 'Payment methods',
    things: 'payment methods',
  },
  {
    list: 'order-expense-categories',
    route: 'order-expense-categories',
    heading: 'Order Expense Categories',
    tableName: 'Order expense categories',
    things: 'order expense categories',
  },
  { list: 'expense-categories', route: null, heading: 'Company Expense Categories', tableName: 'Expense categories', things: 'categories' },
];

/** Answers the list of any tab, the company categories included. */
function serve(list: ListKey, answer: (() => unknown[] | Response | Promise<unknown[] | Response>)): void {
  if (list === 'expense-categories') {
    categoriesBackend(async () => (await answer()) as never);
  } else {
    listBackend(list, async () => (await answer()) as never);
  }
}

describe.each(STATES)('S1 list states: $list', ({ list, heading, tableName, things }) => {
  it('announces the first load with the list loading name, then shows the rows', async () => {
    serve(list, async () => {
      await delay(150);
      return [listItem('44444444-0000-4000-8000-000000000001', 'Sample entry', 'info')];
    });
    renderSection(list);

    expect(await screen.findByText(`Loading ${things}…`)).toBeInTheDocument();
    await screen.findByText('Sample entry');
    expect(screen.queryByText(`Loading ${things}…`)).toBeNull();
  });

  it("shows Couldn't load {things} with Try Again, and Try Again reads the list again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    serve(list, () => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : [listItem('44444444-0000-4000-8000-000000000001', 'Sample entry', 'info')];
    });
    const view = renderSection(list);

    expect(await screen.findByText(`Couldn't load ${things}.`)).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('Sample entry');
    expect(calls).toBe(2);
  });

  it('shows the empty list pattern with its words when the list holds nothing', async () => {
    serve(list, () => []);
    const view = renderSection(list);

    expect(await screen.findByText(`No ${things} yet`)).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    await expectNoAxeViolations(view.container);
  });

  it('shows a list that holds only an entry named Others as one row with the Edit action alone', async () => {
    serve(list, () =>
      list === 'expense-categories'
        ? [categoryItem(OTHERS_ID, 'Others', 'neutral', { isOthers: true })]
        : [listItem('44444444-0000-4000-8000-000000000009', 'Others', 'neutral', { isOthers: true })],
    );
    renderSection(list);
    await screen.findByRole('table', { name: tableName });

    const row = rowOf('Others');
    expect(within(row).getByText('Always listed last')).toBeVisible();
    expect(titlesIn(row)).toEqual(['Edit Others']);
  });
});
