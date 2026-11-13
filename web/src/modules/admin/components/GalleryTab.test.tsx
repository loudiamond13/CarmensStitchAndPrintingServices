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
  const table = await screen.findByRole('table', { name: 'Gallery items' });
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
    expect(within(rows).getAllByRole('option').map((option) => option.textContent)).toEqual(['10', '20', '50', '100']);

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

