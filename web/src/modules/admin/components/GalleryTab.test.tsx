import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { GalleryTab } from '@/modules/admin/components/GalleryTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoGalleryItems,
  demoLines,
  GALLERY_IDS,
  GALLERY_ORDER_IDS,
  galleryItemsBackend,
  LINE_IDS,
  manyGalleryItems,
  problemAnswer,
  type GalleryItemFixture,
  productLinesBackend,
} from '@/test/siteContentFixtures';
import { prepareImage } from '@/utils/images';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// S6 Gallery tab (GAL-03, D-10, D-15, D-27; plan 11-32): the paged list of every shown order and every upload, in gallery order.

// axe over six rows takes longer than the 5 second default on a busy machine.
vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
  productLinesBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
  vi.mocked(prepareImage).mockReset();
});

function renderTab(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <ToastProvider>
            <GalleryTab />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

async function openTab(search = '', onUrlUpdate?: OnUrlUpdateFunction) {
  const view = renderTab(search, onUrlUpdate);
  // The first render of a fresh test worker loads the whole component graph, which can take longer than the 1 second default.
  const table = await screen.findByRole('table', { name: 'Gallery items' }, { timeout: 5000 });
  return { ...view, table };
}

/** The body rows of the table, in order. */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

/** The row at this place; the table is known to hold it. */
function rowAt(rows: readonly HTMLElement[], index: number): HTMLElement {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`No row at place ${String(index)}`);
  }
  return row;
}

/** The demo item at this place of the gallery order. */
function demoItem(index: number): GalleryItemFixture {
  const item = demoGalleryItems()[index];
  if (item === undefined) {
    throw new Error(`No demo item at place ${String(index)}`);
  }
  return item;
}

/** The text of one cell of a row, by its phone label. */
function cellText(row: HTMLElement, label: string): string {
  return row.querySelector(`td[data-label="${label}"]`)?.textContent ?? '';
}

describe('the list', () => {
  it('has the card head, the Add Photo button and the table named "Gallery items"', async () => {
    galleryItemsBackend();
    await openTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Gallery' })).toBeVisible();
    expect(
      screen.getByText('Every photo on the public Gallery, in this order. New items start at the top.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Photo' })).toBeVisible();
  });

  it('lists every item in gallery order, uploads and orders together, and reads "Showing 6 items · in gallery order"', async () => {
    galleryItemsBackend();
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => cellText(row, 'Photo'))).toEqual([
      'Sample Barangay RidersMoto · 12 pcs',
      'Brgy. Sample BallersBasketball · 17 pcs',
      'Sample City SpikersVolleyball · 12 pcs',
      'Sample Old HoopersBasketball · 9 pcs',
      'Sample Riders MCMoto · 20 pcs',
      'Hidden Sample TeamPolo · 8 pcs',
    ]);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 6 items · in gallery order');
  });

  it('reads "Showing 1 item" for one item', async () => {
    galleryItemsBackend([demoItem(0)]);
    await openTab();

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 item · in gallery order');
  });

  it('shows "Uploaded" for an upload and the order number as a link to the order for an order item', async () => {
    galleryItemsBackend();
    const { table } = await openTab();
    const rows = bodyRows(table);

    expect(cellText(rowAt(rows, 0), 'Source')).toBe('Uploaded');
    const link = within(rowAt(rows, 1)).getByRole('link', { name: 'ORD-2026-0148' });
    expect(link).toHaveAttribute('href', `/admin/orders/${GALLERY_ORDER_IDS.ballers}`);
    expect(within(rowAt(rows, 0)).queryByRole('link')).toBeNull();
  });

  it('shows a 56 pixel decorative thumb for an item with a photo and a placeholder for one without', async () => {
    const items = demoGalleryItems().map((item, index) => (index === 3 ? { ...item, thumb: null } : item));
    galleryItemsBackend(items);
    const { table } = await openTab();
    const rows = bodyRows(table);

    const thumb = within(rowAt(rows, 0)).getByRole('presentation', { hidden: true });
    expect(thumb).toHaveAttribute('width', '56');
    expect(thumb).toHaveAttribute('height', '56');
    expect(within(rowAt(rows, 3)).queryByRole('presentation', { hidden: true })).toBeNull();
  });

  it('shows "Shown" or "Hidden" for an upload, "Shown" for an order item, and "Line hidden" under an item whose line is hidden', async () => {
    galleryItemsBackend();
    const { table } = await openTab();
    const rows = bodyRows(table);

    expect(cellText(rowAt(rows, 0), 'Status')).toBe('Shown');
    expect(cellText(rowAt(rows, 1), 'Status')).toBe('Shown');
    expect(cellText(rowAt(rows, 5), 'Status')).toBe('HiddenLine hidden');
    expect(within(rowAt(rows, 0)).queryByText('Line hidden')).toBeNull();
  });

  it('keeps an item with no line and no pieces to a name alone under the photo', async () => {
    const items = [{ ...demoItem(3), lineId: null, lineShortName: null, pieces: null }];
    galleryItemsBackend(items);
    const { table } = await openTab();

    expect(cellText(rowAt(bodyRows(table), 0), 'Photo')).toBe('Sample Old Hoopers');
  });

  it('opens the Add Photo window from the head button', async () => {
    galleryItemsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(screen.getByRole('button', { name: 'Add Photo' }));

    expect(await screen.findByRole('dialog', { name: 'Add Photo' })).toBeVisible();
  });

  it('has no axe violations', async () => {
    galleryItemsBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });
});

describe('the first load', () => {
  it('reads page 1 at 20 rows with no line', async () => {
    const backend = galleryItemsBackend();
    await openTab();

    expect(backend.gets[0]).toEqual({ line: null, page: '1', pageSize: '20' });
  });
});

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

/** The URL writes the tab made, in order, as the history mode and the query string. */
function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]) => ({ history: event.options.history, query: event.queryString }));
}

const lineSelect = (): HTMLSelectElement => screen.getByLabelText('Product line');

describe('the Product line filter (WEB-10)', () => {
  it('offers All lines first, then every line in the Manager order, a hidden one as "{title} (hidden)"', async () => {
    productLinesBackend(demoLines().map((line) => (line.id === LINE_IDS.polo ? { ...line, isActive: false } : line)));
    galleryItemsBackend();
    await openTab();

    await waitFor(() => {
      expect(within(lineSelect()).getAllByRole('option').length).toBe(7);
    });
    const labels = within(lineSelect())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels[0]).toBe('All lines');
    expect(labels).toContain('Basketball Jerseys');
    expect(labels.filter((label) => label.endsWith(' (hidden)'))).toHaveLength(1);
    expect(lineSelect()).toHaveValue('');
  });

  it('choosing a line asks the server for that line, replaces the URL entry and drops the page', async () => {
    const backend = galleryItemsBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openTab('?page=2', onUrlUpdate);
    await waitFor(() => {
      expect(within(lineSelect()).getAllByRole('option').length).toBeGreaterThan(1);
    });

    fireEvent.change(lineSelect(), { target: { value: LINE_IDS.moto } });

    await waitFor(() => {
      expect(backend.gets.at(-1)).toEqual({ line: LINE_IDS.moto, page: '1', pageSize: '20' });
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: `?line=${LINE_IDS.moto}` });
    expect(await screen.findByText(/Showing/)).toHaveTextContent('Showing 2 items · in gallery order');
  });

  it('reads a line from the URL, asks for it, and shows it chosen', async () => {
    const backend = galleryItemsBackend();
    await openTab(`?line=${LINE_IDS.moto}`);

    await waitFor(() => {
      expect(lineSelect()).toHaveValue(LINE_IDS.moto);
    });
    expect(backend.gets[0]).toEqual({ line: LINE_IDS.moto, page: '1', pageSize: '20' });
  });

  it('drops a line that the lines list does not hold, with one replace, once the lines have loaded', async () => {
    const backend = galleryItemsBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openTab('?line=8c1f4a20-0000-4000-8000-0000000000ff', onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    await waitFor(() => {
      expect(backend.gets.at(-1)?.line).toBeNull();
    });
  });
});

describe('paging and the page size (WEB-10)', () => {
  it('pages the rows with the server: Page 1 of 2, Next pushes ?page=2 and reads page 2', async () => {
    const backend = galleryItemsBackend(manyGalleryItems(25));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    const { table } = await openTab('', onUrlUpdate);

    expect(bodyRows(table)).toHaveLength(20);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 25 items · in gallery order');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 2');

    await user.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => {
      expect(backend.gets.at(-1)).toEqual({ line: null, page: '2', pageSize: '20' });
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'push', query: '?page=2' });
    await waitFor(() => {
      expect(bodyRows(table)).toHaveLength(5);
    });
  });

  it('offers 10, 20, 50 and 100 rows per page, and a size change replaces the entry and drops the page', async () => {
    const backend = galleryItemsBackend(manyGalleryItems(25));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openTab('?page=2', onUrlUpdate);
    const rows = screen.getByLabelText('Rows per page');
    expect(
      within(rows)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '20', '50', '100']);

    fireEvent.change(rows, { target: { value: '10' } });

    await waitFor(() => {
      expect(backend.gets.at(-1)).toEqual({ line: null, page: '1', pageSize: '10' });
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?size=10' });
  });

  it('replaces a page past the last page with the last page', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    galleryItemsBackend(manyGalleryItems(25));
    await openTab('?page=9', onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toContainEqual({ history: 'replace', query: '?page=2' });
    });
  });

  it('falls back from size=9999 and page=0 and removes both with one replace', async () => {
    const backend = galleryItemsBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openTab('?size=9999&page=0', onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    expect(backend.gets[0]).toEqual({ line: null, page: '1', pageSize: '20' });
  });
});

describe('the states', () => {
  it('shows "No gallery photos yet" with the way to fill it and no button, when nothing is on the gallery', async () => {
    galleryItemsBackend([]);
    renderTab();

    expect(await screen.findByRole('heading', { name: 'No gallery photos yet' })).toBeVisible();
    expect(screen.getByText('Show an order from its order page, or add a photo of older work.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show All Lines' })).toBeNull();
  });

  it('with a line filter and no items shows "No items in {Basketball} yet." and Show All Lines clears the filter', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    galleryItemsBackend(demoGalleryItems().filter((item) => item.lineId === LINE_IDS.moto));
    const user = userEvent.setup();
    renderTab(`?line=${LINE_IDS.basketball}`, onUrlUpdate);

    expect(await screen.findByText('No items in Basketball yet.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show All Lines' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
    expect(await screen.findByRole('table', { name: 'Gallery items' })).toBeVisible();
  });

  it('shows "Loading gallery items…" while the first page is read', async () => {
    const gate = createDeferred<undefined>();
    galleryItemsBackend(undefined, { onGet: () => gate.promise.then(() => undefined) });
    renderTab();

    expect(await screen.findByText('Loading gallery items…')).toBeVisible();
    gate.resolve(undefined);
    expect(await screen.findByRole('table', { name: 'Gallery items' })).toBeVisible();
  });

  it('shows "Couldn\'t load gallery items." with Try Again, and reads again on Try Again', async () => {
    let failing = true;
    const backend = galleryItemsBackend(undefined, { onGet: () => (failing ? problemAnswer(500) : undefined) });
    const user = userEvent.setup();
    renderTab();

    expect(await screen.findByText("Couldn't load gallery items.")).toBeVisible();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('table', { name: 'Gallery items' })).toBeVisible();
    expect(backend.gets.length).toBeGreaterThan(1);
  });

  it('has no axe violations when empty, filtered to nothing, loading and failed', async () => {
    galleryItemsBackend([]);
    const empty = renderTab();
    await screen.findByRole('heading', { name: 'No gallery photos yet' });
    await expectNoAxeViolations(empty.container);
    empty.unmount();
    queryClient.clear();

    galleryItemsBackend(demoGalleryItems().filter((item) => item.lineId === LINE_IDS.moto));
    const filtered = renderTab(`?line=${LINE_IDS.basketball}`);
    await screen.findByText('No items in Basketball yet.');
    await expectNoAxeViolations(filtered.container);
    filtered.unmount();
    queryClient.clear();

    galleryItemsBackend(undefined, { onGet: () => problemAnswer(500) });
    const failed = renderTab();
    await screen.findByText("Couldn't load gallery items.");
    await expectNoAxeViolations(failed.container);
  });
});

/** A named button of the list (a row action), whether or not it is aria-disabled. */
function action(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('the row actions (GAL-03, D-15, D-27)', () => {
  it('gives an order item Move up, Move down and a link to its order, and never Edit, Hide or Delete (D-15)', async () => {
    galleryItemsBackend();
    await openTab();

    expect(action('Move Brgy. Sample Ballers up')).toBeVisible();
    expect(action('Move Brgy. Sample Ballers down')).toBeVisible();
    const change = screen.getByRole('link', { name: 'Change Brgy. Sample Ballers on order ORD-2026-0148' });
    expect(change).toHaveAttribute('href', `/admin/orders/${GALLERY_ORDER_IDS.ballers}`);
    for (const name of ['Edit', 'Hide', 'Show', 'Delete']) {
      expect(screen.queryByRole('button', { name: `${name} Brgy. Sample Ballers` })).toBeNull();
    }
  });

  it('gives an upload all five: Move up, Move down, Edit, Hide or Show, and Delete, each named for the row', async () => {
    galleryItemsBackend();
    await openTab();

    for (const name of [
      'Move Sample Old Hoopers up',
      'Move Sample Old Hoopers down',
      'Edit Sample Old Hoopers',
      'Hide Sample Old Hoopers',
      'Delete Sample Old Hoopers',
      'Show Hidden Sample Team',
    ]) {
      expect(action(name)).toBeVisible();
    }
    expect(screen.queryByRole('button', { name: 'Show Sample Old Hoopers' })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Change Sample Old Hoopers/ })).toBeNull();
  });

  it('leaves Move up aria-disabled on the first item and Move down aria-disabled on the last', async () => {
    galleryItemsBackend();
    await openTab();

    expect(action('Move Sample Barangay Riders up')).toHaveAttribute('aria-disabled', 'true');
    expect(action('Move Sample Barangay Riders down')).not.toHaveAttribute('aria-disabled');
    expect(action('Move Hidden Sample Team down')).toHaveAttribute('aria-disabled', 'true');
  });

  it('moves an item down at once: one POST with the direction and one key, the new order, the polite line, and focus stays on Move down', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Move Sample Barangay Riders down'));

    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 1), 'Photo')).toContain('Sample Barangay Riders');
    });
    expect(backend.moves).toHaveLength(1);
    expect(backend.moves[0]).toMatchObject({ id: GALLERY_IDS.newUpload, direction: 'down', lineId: undefined });
    expect(backend.moves[0]?.key).toMatch(/\S/);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    expect(screen.getByText('Sample Barangay Riders moved to place 2 of 6.')).toBeInTheDocument();
    await waitFor(() => {
      expect(action('Move Sample Barangay Riders down')).toHaveFocus();
    });
  });

  it('with a line filter sends the line, so the item swaps with the next item of that line', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    await openTab(`?line=${LINE_IDS.moto}`);

    await user.click(action('Move Sample Barangay Riders down'));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(1);
    });
    expect(backend.moves[0]).toMatchObject({ direction: 'down', lineId: LINE_IDS.moto });
  });

  it('while one move saves, every other control waits and the pressed one is busy', async () => {
    const gate = createDeferred<undefined>();
    galleryItemsBackend(undefined, { onMove: () => gate.promise.then(() => undefined) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Sample Barangay Riders down'));

    await waitFor(() => {
      expect(action('Move Sample Barangay Riders down')).toHaveAttribute('aria-busy', 'true');
    });
    expect(action('Move Sample Old Hoopers up')).toHaveAttribute('aria-disabled', 'true');
    expect(action('Edit Sample Old Hoopers')).toHaveAttribute('aria-disabled', 'true');
    gate.resolve(undefined);
    await waitFor(() => {
      expect(action('Move Sample Old Hoopers up')).not.toHaveAttribute('aria-disabled');
    });
  });

  it('a move across the bottom edge of page 1 follows the item to page 2 with a push, focuses its Move down there and says "moved to page 2."', async () => {
    const backend = galleryItemsBackend(manyGalleryItems(25));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    const { table } = await openTab('?size=10', onUrlUpdate);
    expect(bodyRows(table)).toHaveLength(10);

    await user.click(action('Move Sample Team 10 down'));

    await waitFor(() => {
      expect(backend.gets.at(-1)).toEqual({ line: null, page: '2', pageSize: '10' });
    });
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'push', query: '?page=2&size=10' });
    expect(screen.getByText('Sample Team 10 moved to page 2.')).toBeInTheDocument();
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 0), 'Photo')).toContain('Sample Team 10');
    });
    await waitFor(() => {
      expect(action('Move Sample Team 10 down')).toHaveFocus();
    });
  });

  it('a move across the top edge of page 2 goes back to page 1, and the item is the last row there', async () => {
    const backend = galleryItemsBackend(manyGalleryItems(25));
    const user = userEvent.setup();
    const { table } = await openTab('?page=2&size=10');
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 0), 'Photo')).toContain('Sample Team 11');
    });

    await user.click(action('Move Sample Team 11 up'));

    await waitFor(() => {
      expect(backend.gets.at(-1)).toEqual({ line: null, page: '1', pageSize: '10' });
    });
    expect(screen.getByText('Sample Team 11 moved to page 1.')).toBeInTheDocument();
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 9), 'Photo')).toContain('Sample Team 11');
    });
    await waitFor(() => {
      expect(action('Move Sample Team 11 up')).toHaveFocus();
    });
  });

  it('leaves Move up off on the first item of page 1 and Move down off on the last item of the last page', async () => {
    galleryItemsBackend(manyGalleryItems(25));
    await openTab('?size=10');
    expect(action('Move Sample Team 01 up')).toHaveAttribute('aria-disabled', 'true');
    expect(action('Move Sample Team 10 down')).not.toHaveAttribute('aria-disabled');
  });

  it('hides an upload at once with no question: the toast, the Hidden badge, the Show control, and focus stays on it', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Hide Sample Old Hoopers'));

    expect(await screen.findByText('Photo hidden')).toBeVisible();
    expect(screen.getByText("It's off the Gallery. Nothing is deleted.")).toBeVisible();
    expect(backend.hides).toEqual([GALLERY_IDS.hoopers]);
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 3), 'Status')).toBe('Hidden');
    });
    await waitFor(() => {
      expect(action('Show Sample Old Hoopers')).toHaveFocus();
    });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('shows a hidden upload again with the toast "Photo shown"', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Show Hidden Sample Team'));

    expect(await screen.findByText('Photo shown')).toBeVisible();
    expect(backend.shows).toEqual([GALLERY_IDS.hiddenTeam]);
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 5), 'Status')).toContain('Shown');
    });
  });

  it('a refused move says so in a danger toast and frees every control', async () => {
    galleryItemsBackend(undefined, { onMove: () => problemAnswer(409) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Sample Barangay Riders down'));

    expect(await screen.findByText("Couldn't move Sample Barangay Riders")).toBeVisible();
    await waitFor(() => {
      expect(action('Move Sample Old Hoopers up')).not.toHaveAttribute('aria-disabled');
    });
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('sends a new Idempotency-Key for the same move once a lost answer and the list read again show it already ran', async () => {
    let answerLost = true;
    const backend = galleryItemsBackend(undefined, {
      onMove: (_id, _direction, current) => {
        if (!answerLost) {
          return undefined;
        }
        // The move ran on the server, but its answer never came back.
        if (current.moves.length === 1) {
          const items = [...current.items];
          const index = items.findIndex((item) => item.name === 'Sample Barangay Riders');
          const riders = items[index];
          const below = items[index + 1];
          if (riders !== undefined && below !== undefined) {
            items[index] = below;
            items[index + 1] = riders;
          }
          current.items = items;
        }
        return problemAnswer(500);
      },
    });
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Move Sample Barangay Riders down'));
    expect(await screen.findByText("Couldn't move Sample Barangay Riders")).toBeVisible();
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 1), 'Photo')).toContain('Sample Barangay Riders');
    });
    answerLost = false;
    const firstKey = backend.moves[0]?.key;
    const sent = backend.moves.length;
    await user.click(action('Move Sample Barangay Riders down'));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(sent + 1);
    });
    expect(backend.moves[sent]?.key).not.toBe(firstKey);
  });

  it('keeps the same Idempotency-Key for the same move while the list read again does not show it yet, because it may still be running on the server', async () => {
    const backend = galleryItemsBackend(undefined, { onMove: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move Sample Barangay Riders down'));
    expect(await screen.findByText("Couldn't move Sample Barangay Riders")).toBeVisible();
    await waitFor(() => {
      expect(backend.gets.length).toBeGreaterThanOrEqual(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(action('Move Sample Barangay Riders down'));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(2);
    });
    expect(backend.moves[1]?.key).toBe(backend.moves[0]?.key);
  });

  it('keeps the same Idempotency-Key for a repeated Hide while the list read again does not show it yet, because it may still be running on the server', async () => {
    const backend = galleryItemsBackend(undefined, { onHide: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Hide Sample Old Hoopers'));
    expect(await screen.findByText("Couldn't hide Sample Old Hoopers")).toBeVisible();
    await waitFor(() => {
      expect(backend.gets.length).toBeGreaterThanOrEqual(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(action('Hide Sample Old Hoopers'));

    await waitFor(() => {
      expect(backend.hideKeys).toHaveLength(2);
    });
    expect(backend.hideKeys[1]).toBe(backend.hideKeys[0]);
  });

  it('a hide that finds the upload gone says so and reads the list again', async () => {
    const backend = galleryItemsBackend(undefined, {
      onHide: () => problemAnswer(404, { code: 'gallery-items.not-found' }),
    });
    const user = userEvent.setup();
    await openTab();
    const reads = backend.gets.length;

    await user.click(action('Hide Sample Old Hoopers'));

    expect(await screen.findByText("Couldn't hide Sample Old Hoopers")).toBeVisible();
    await waitFor(() => {
      expect(backend.gets.length).toBeGreaterThan(reads);
    });
  });

  it('opens the Edit Photo window for an upload with its saved words', async () => {
    galleryItemsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Edit Sample Old Hoopers'));

    expect(await screen.findByRole('dialog', { name: 'Edit Photo' })).toBeVisible();
    expect(screen.getByLabelText(/^Team or name/)).toHaveValue('Sample Old Hoopers');
    expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeVisible();
  });

  it('after a saved edit the list shows the new words and focus goes to its Edit control', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();
    await user.click(action('Edit Sample Old Hoopers'));
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    fireEvent.change(screen.getByLabelText(/^Team or name/), { target: { value: 'Sample Old Hoopers Two' } });

    await user.click(screen.getByRole('button', { name: 'Save Photo' }));

    expect(await screen.findByText('Photo saved')).toBeVisible();
    expect(backend.puts[0]?.id).toBe(GALLERY_IDS.hoopers);
    await waitFor(() => {
      expect(cellText(rowAt(bodyRows(table), 3), 'Photo')).toContain('Sample Old Hoopers Two');
    });
    await waitFor(() => {
      expect(action('Edit Sample Old Hoopers Two')).toHaveFocus();
    });
  });

  it('asks before deleting with Cancel focused first, names the team, and Cancel leaves the row', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Delete Sample Old Hoopers'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this photo?' });
    expect(within(dialog).getByText("Sample Old Hoopers. It's removed from the Gallery for good.")).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(backend.deletes).toHaveLength(0);
    expect(screen.getByText('Sample Old Hoopers')).toBeVisible();
  });

  it('deletes after the question: the row leaves, the toast says Photo deleted, and focus goes to the next row', async () => {
    const backend = galleryItemsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Delete Sample Old Hoopers'));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this photo?' })).getByRole('button', {
        name: 'Delete Photo',
      }),
    );

    expect(await screen.findByText('Photo deleted')).toBeVisible();
    expect(backend.deletes).toEqual([GALLERY_IDS.hoopers]);
    await waitFor(() => {
      expect(bodyRows(table)).toHaveLength(5);
    });
    expect(screen.queryByRole('button', { name: 'Delete Sample Old Hoopers' })).toBeNull();
    await waitFor(() => {
      expect(action('Move Sample Riders MC up')).toHaveFocus();
    });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a delete that finds the upload already gone closes the question, says "Already deleted" and reads the list again', async () => {
    const backend = galleryItemsBackend(undefined, {
      onDelete: () => problemAnswer(404, { code: 'gallery-items.not-found' }),
    });
    const user = userEvent.setup();
    await openTab();
    const reads = backend.gets.length;

    await user.click(action('Delete Sample Old Hoopers'));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this photo?' })).getByRole('button', {
        name: 'Delete Photo',
      }),
    );

    expect(await screen.findByText('Already deleted')).toBeVisible();
    await waitFor(() => {
      expect(backend.gets.length).toBeGreaterThan(reads);
    });
  });

  it('has no axe violations with every row action on the page', async () => {
    galleryItemsBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });
});
