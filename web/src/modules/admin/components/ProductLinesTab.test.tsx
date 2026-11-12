import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { ProductLinesTab } from '@/modules/admin/components/ProductLinesTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoLineDetail,
  demoLines,
  LINE_IDS,
  LINE_TYPE_IDS,
  problemAnswer,
  productLinesBackend,
} from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S3 Products tab (CONT-02, D-01; plan 11-20): the ordered list of every product line, shown and hidden.

// axe over six rows takes longer than the 5 second default on a busy machine.
vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function renderTab() {
  const router = createMemoryRouter(
    [
      { path: '/admin/site-content', element: <ProductLinesTab /> },
      { path: '/admin/site-content/products/new', element: <p>The new line</p> },
      { path: '/admin/site-content/products/:lineId', element: <p>One line</p> },
    ],
    { initialEntries: ['/admin/site-content'] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

async function openTab() {
  const view = renderTab();
  const table = await screen.findByRole('table', { name: 'Product lines' });
  return { ...view, table };
}

/** The body rows of the table, in order. */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

/** The text of one cell of a row, by its phone label. */
function cellText(row: HTMLElement, label: string): string {
  return row.querySelector(`td[data-label="${label}"]`)?.textContent ?? '';
}

describe('the Product lines card (S3, CONT-02)', () => {
  it('has the card heading and hint and Add Product Line, a link to the new line editor', async () => {
    productLinesBackend();
    await openTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Product lines' })).toBeVisible();
    expect(
      screen.getByText('Shown on the Home and Products pages, in this order. The Gallery filters use the short names.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add Product Line' })).toHaveAttribute(
      'href',
      '/admin/site-content/products/new',
    );
  });

  it('lists all six lines in display order with the short name under each title', async () => {
    productLinesBackend();
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => cellText(row, 'Product line'))).toEqual([
      'Basketball JerseysBasketball',
      'Volleyball JerseysVolleyball',
      'Moto and Riding JerseysMoto',
      'Long SleevesLong Sleeves',
      'Polo ShirtsPolo',
      'Custom DesignsCustom',
    ]);
  });

  it('names the columns Product line, Starts at, Order types, Gallery, Status and a hidden Actions', async () => {
    productLinesBackend();
    const { table } = await openTab();

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Product line', 'Starts at', 'Order types', 'Gallery', 'Status', 'Actions']);
  });

  it('writes each title as a link to its editor, named by the title alone', async () => {
    productLinesBackend();
    await openTab();

    expect(screen.getByRole('link', { name: 'Basketball Jerseys' })).toHaveAttribute(
      'href',
      `/admin/site-content/products/${LINE_IDS.basketball}`,
    );
    expect(screen.getByRole('link', { name: 'Edit Polo Shirts' })).toHaveAttribute(
      'href',
      `/admin/site-content/products/${LINE_IDS.polo}`,
    );
  });

  it('shows the price as money with the minimum under it, and the empty marker when there is no price', async () => {
    productLinesBackend();
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows.map((row) => cellText(row, 'Starts at')).slice(0, 2)).toEqual(['₱650.00min. 10 pcs', 'Not set']);
  });

  it('counts the order types and the gallery items filed under each line, a zero as "0"', async () => {
    const backend = productLinesBackend();
    backend.used[LINE_IDS.volleyball] = { gallery: 3 };
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows.map((row) => cellText(row, 'Order types'))).toEqual(['1', '1', '0', '0', '0', '0']);
    expect(rows.map((row) => cellText(row, 'Gallery'))).toEqual(['0', '3', '0', '0', '0', '0']);
  });

  it('says Shown or Hidden in each status badge, and a hidden row keeps its words', async () => {
    productLinesBackend([
      ...demoLines().filter((line) => line.id !== LINE_IDS.polo),
      demoLineDetail('polo', { isActive: false }),
    ]);
    const { table } = await openTab();

    const statuses = bodyRows(table).map((row) => cellText(row, 'Status'));
    expect(statuses).toEqual(['Shown', 'Shown', 'Shown', 'Shown', 'Hidden', 'Shown']);
  });

  it('draws the small main photo when the line has one and the placeholder when it has none', async () => {
    const backend = productLinesBackend();
    backend.used[LINE_IDS.basketball] = { photos: 1, thumb: '/api/testing/images/photo01?size=csps_sq_88' };
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows[0]?.querySelector('img')).toHaveAttribute('src', '/api/testing/images/photo01?size=csps_sq_88');
    expect(rows[1]?.querySelector('img')).toBeNull();
  });

  it('has no axe violations', async () => {
    productLinesBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });
});

// Move, Hide, Show and Delete (D-08, PUB-03; plan 11-20).

/** A named button of the list (a row action), whether or not it is aria-disabled. */
function action(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('the caption and the list states (S3)', () => {
  it('explains hide versus delete under the table', async () => {
    productLinesBackend();
    await openTab();

    expect(
      screen.getByText(
        "A product line with photos, gallery items or linked order types can't be deleted. Hide it to take it off the website. Nothing is lost.",
      ),
    ).toBeVisible();
  });

  it('says Loading product lines while the first answer is on its way, then it is loaded', async () => {
    const gate = createDeferred<undefined>();
    productLinesBackend(undefined, {
      onGetList: async () => {
        await gate.promise;
        return undefined;
      },
    });
    renderTab();

    expect(await screen.findByText('Loading product lines…')).toBeInTheDocument();
    gate.resolve(undefined);
    expect(await screen.findByRole('table', { name: 'Product lines' })).toBeVisible();
    expect(screen.getByText('Product lines loaded.')).toBeInTheDocument();
  });

  it("says Couldn't load product lines with Try Again, and Try Again reads the list again", async () => {
    let fail = true;
    const backend = productLinesBackend(undefined, {
      onGetList: () => (fail ? problemAnswer(500) : undefined),
    });
    const { container } = renderTab();

    expect(await screen.findByText("Couldn't load product lines.")).toBeVisible();
    await expectNoAxeViolations(container);
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('table', { name: 'Product lines' })).toBeVisible();
    expect(backend.listGets).toBe(2);
  });

  it('with no line says No product lines yet and what to do, and has no button of its own (the head holds Add Product Line)', async () => {
    productLinesBackend([]);
    const { container } = renderTab();

    expect(await screen.findByText('No product lines yet')).toBeVisible();
    expect(screen.getByText('Add your first product line to show it on the Home and Products pages.')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Add Product Line' })).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});

describe('Move up and Move down (S3, D-51)', () => {
  it('names each row action for its line, each with a matching title', async () => {
    productLinesBackend();
    await openTab();

    for (const name of [
      'Move Polo Shirts up',
      'Move Polo Shirts down',
      'Edit Polo Shirts',
      'Hide Polo Shirts',
      'Delete Polo Shirts',
    ]) {
      expect(screen.getByRole(name.startsWith('Edit') ? 'link' : 'button', { name })).toHaveAttribute('title', name);
    }
  });

  it('moves Moto up at once with no question: the request, the public data cleared, the focus staying on its Move up and a polite line', async () => {
    const backend = productLinesBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Moto and Riding Jerseys up'));

    expect(await screen.findByText('Moto and Riding Jerseys moved to position 2 of 6.')).toBeInTheDocument();
    expect(backend.moves).toEqual([
      expect.objectContaining({ id: LINE_IDS.moto, direction: 'up', key: expect.stringMatching(/\S/) as string }),
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(action('Move Moto and Riding Jerseys up')).toHaveFocus();
    });
    const rows = bodyRows(screen.getByRole('table', { name: 'Product lines' }));
    expect(rows.map((row) => cellText(row, 'Product line').slice(0, 10))).toEqual([
      'Basketball',
      'Moto and Ri',
      'Volleyball',
      'Long Sleev',
      'Polo Shirt',
      'Custom Des',
    ]);
    expect(screen.getByText('Moto and Riding Jerseys moved to position 2 of 6.')).toHaveAttribute('role', 'status');
  });

  it('after a move to the first place, Move up is aria-disabled and focus goes to the Move down of the same row', async () => {
    productLinesBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Volleyball Jerseys up'));

    expect(await screen.findByText('Volleyball Jerseys moved to position 1 of 6.')).toBeInTheDocument();
    await waitFor(() => {
      expect(action('Move Volleyball Jerseys down')).toHaveFocus();
    });
    expect(action('Move Volleyball Jerseys up')).toHaveAttribute('aria-disabled', 'true');
  });

  it('after a move to the last place, Move down is aria-disabled and focus goes to the Move up of the same row', async () => {
    productLinesBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Polo Shirts down'));
    expect(await screen.findByText('Polo Shirts moved to position 6 of 6.')).toBeInTheDocument();

    await waitFor(() => {
      expect(action('Move Polo Shirts up')).toHaveFocus();
    });
    expect(action('Move Polo Shirts down')).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps the first row Move up and the last row Move down aria-disabled but focusable, and a press sends nothing', async () => {
    const backend = productLinesBackend();
    const user = userEvent.setup();
    await openTab();
    const first = action('Move Basketball Jerseys up');
    const last = action('Move Custom Designs down');

    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(last).toHaveAttribute('aria-disabled', 'true');
    expect(action('Move Basketball Jerseys down')).not.toHaveAttribute('aria-disabled');
    first.focus();
    expect(first).toHaveFocus();
    await user.click(first);
    await user.click(last);

    expect(backend.moves).toHaveLength(0);
  });

  it('while one row saves, that row other actions are aria-disabled and keep focus, and other rows stay available', async () => {
    const gate = createDeferred<undefined>();
    const backend = productLinesBackend(undefined, {
      onMove: async () => {
        await gate.promise;
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Moto and Riding Jerseys up'));

    await waitFor(() => {
      expect(action('Move Moto and Riding Jerseys up')).toHaveAttribute('aria-busy', 'true');
    });
    for (const name of ['Move Moto and Riding Jerseys down', 'Hide Moto and Riding Jerseys']) {
      expect(action(name)).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByRole('link', { name: 'Edit Moto and Riding Jerseys' })).toBeVisible();
    expect(action('Hide Polo Shirts')).not.toHaveAttribute('aria-disabled');
    expect(action('Move Moto and Riding Jerseys up')).toHaveFocus();
    await user.click(action('Hide Moto and Riding Jerseys'));
    expect(backend.hides).toHaveLength(0);

    gate.resolve(undefined);
    expect(await screen.findByText('Moto and Riding Jerseys moved to position 2 of 6.')).toBeInTheDocument();
  });

  it('shows a danger toast with the shared error line when a move fails, and changes nothing', async () => {
    productLinesBackend(undefined, { onMove: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Moto and Riding Jerseys up'));

    expect(await screen.findByText("Couldn't move Moto and Riding Jerseys")).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('Hide and Show (S3, D-08, PUB-03)', () => {
  it('hides a line at once with no question: the toast, the public data cleared, the badge Hidden and focus staying on the toggle, now Show', async () => {
    const backend = productLinesBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Hide Polo Shirts'));

    expect(await screen.findByText('Polo Shirts hidden')).toBeVisible();
    expect(screen.getByText('It and its gallery photos are off the website. Nothing is deleted.')).toBeVisible();
    expect(backend.hides).toEqual([LINE_IDS.polo]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(action('Show Polo Shirts')).toHaveFocus();
    });
    expect(bodyRows(table).map((row) => cellText(row, 'Status'))).toEqual([
      'Shown',
      'Shown',
      'Shown',
      'Shown',
      'Hidden',
      'Shown',
    ]);
  });

  it('shows a hidden line again with its toast and keeps focus on the toggle, now Hide', async () => {
    const backend = productLinesBackend([
      ...demoLines().filter((line) => line.id !== LINE_IDS.polo),
      demoLineDetail('polo', { isActive: false }),
    ]);
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Show Polo Shirts'));

    expect(await screen.findByText('Polo Shirts shown')).toBeVisible();
    expect(screen.getByText("It's on the website again.")).toBeVisible();
    expect(backend.shows).toEqual([LINE_IDS.polo]);
    await waitFor(() => {
      expect(action('Hide Polo Shirts')).toHaveFocus();
    });
  });

  it('shows a danger toast when a hide fails, and the row keeps its action', async () => {
    productLinesBackend(undefined, { onHide: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Hide Polo Shirts'));

    expect(await screen.findByText("Couldn't hide Polo Shirts")).toBeVisible();
    expect(action('Hide Polo Shirts')).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('Delete (S3, D-08)', () => {
  it('offers Delete only for a line nothing is filed under (no product type, no photo, no gallery item)', async () => {
    const backend = productLinesBackend();
    backend.used[LINE_IDS.polo] = { gallery: 2 };
    await openTab();

    expect(screen.queryByRole('button', { name: 'Delete Basketball Jerseys' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Volleyball Jerseys' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Polo Shirts' })).toBeNull();
    for (const title of ['Moto and Riding Jerseys', 'Long Sleeves', 'Custom Designs']) {
      expect(action(`Delete ${title}`)).toBeVisible();
    }
  });

  it('asks Delete Polo Shirts? with the cannot-be-undone words, Cancel focused first, and deletes nothing on Cancel', async () => {
    const backend = productLinesBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Delete Polo Shirts'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete Polo Shirts?' });
    expect(within(dialog).getByText("It's removed for good. This can't be undone.")).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Product Line' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.deletes).toHaveLength(0);
  });

  it('deletes on Delete Product Line: the toast, the row gone, the public data cleared and focus on the Edit of the next row', async () => {
    const backend = productLinesBackend();
    const user = userEvent.setup();
    const { table } = await openTab();
    await user.click(action('Delete Polo Shirts'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Product Line' }));

    expect(await screen.findByText('Product line deleted')).toBeVisible();
    expect(screen.getByText('Polo Shirts was removed.')).toBeVisible();
    expect(backend.deletes).toEqual([LINE_IDS.polo]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(bodyRows(table)).toHaveLength(5);
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Edit Custom Designs' })).toHaveFocus();
    });
  });

  it('puts focus on the Edit of the previous row when the last row is deleted', async () => {
    productLinesBackend();
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete Custom Designs'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Product Line' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Edit Polo Shirts' })).toHaveFocus();
    });
  });

  it('shows the server line in the dialog when the line became used meanwhile, and the list reads again so Delete is gone', async () => {
    const backend = productLinesBackend(undefined, {
      onDelete: (id, held) => {
        held.lines = held.lines.map((line) =>
          line.id === id ? { ...line, productTypeIds: [LINE_TYPE_IDS.cycling] } : line,
        );
        return problemAnswer(422, { code: 'product-lines.in-use' });
      },
    });
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete Polo Shirts'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Polo Shirts?' });

    await user.click(within(dialog).getByRole('button', { name: 'Delete Product Line' }));

    expect(await within(dialog).findByText('This product line is in use. Hide it instead.')).toBeVisible();
    await waitFor(() => {
      expect(backend.listGets).toBe(2);
    });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Delete Polo Shirts' })).toBeNull();
  });

  it('says Already deleted and reads the list again when the line was deleted by someone else', async () => {
    const backend = productLinesBackend(undefined, {
      onDelete: (id, held) => {
        held.lines = held.lines.filter((line) => line.id !== id);
        return problemAnswer(404, { code: 'product-lines.not-found' });
      },
    });
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete Polo Shirts'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Product Line' }));

    expect(await screen.findByText('Already deleted')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Edit Polo Shirts' })).toBeNull();
    });
    expect(backend.listGets).toBe(2);
  });

  it('has no axe violations while the Delete question shows', async () => {
    productLinesBackend();
    const user = userEvent.setup();
    const { container } = await openTab();
    await user.click(action('Delete Polo Shirts'));
    await screen.findByRole('dialog', { name: 'Delete Polo Shirts?' });

    await expectNoAxeViolations(container);
  });
});
