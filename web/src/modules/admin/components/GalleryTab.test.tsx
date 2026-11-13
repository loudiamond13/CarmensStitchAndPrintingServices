import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoGalleryItems,
  GALLERY_ORDER_IDS,
  galleryItemsBackend,
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
    galleryItemsBackend([demoGalleryItems()[0] ?? demoGalleryItems()[1]!]);
    await openTab();

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 item · in gallery order');
  });

  it('shows "Uploaded" for an upload and the order number as a link to the order for an order item', async () => {
    galleryItemsBackend();
    const { table } = await openTab();
    const rows = bodyRows(table);

    expect(cellText(rows[0] as HTMLElement, 'Source')).toBe('Uploaded');
    const link = within(rows[1] as HTMLElement).getByRole('link', { name: 'ORD-2026-0148' });
    expect(link).toHaveAttribute('href', `/admin/orders/${GALLERY_ORDER_IDS.ballers}`);
    expect(within(rows[0] as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('shows a 56 pixel decorative thumb for an item with a photo and a placeholder for one without', async () => {
    const items = demoGalleryItems().map((item, index) => (index === 3 ? { ...item, thumb: null } : item));
    galleryItemsBackend(items);
    const { table } = await openTab();
    const rows = bodyRows(table);

    const thumb = within(rows[0] as HTMLElement).getByRole('presentation', { hidden: true });
    expect(thumb).toHaveAttribute('width', '56');
    expect(thumb).toHaveAttribute('height', '56');
    expect(within(rows[3] as HTMLElement).queryByRole('presentation', { hidden: true })).toBeNull();
  });

  it('shows "Shown" or "Hidden" for an upload, "Shown" for an order item, and "Line hidden" under an item whose line is hidden', async () => {
    galleryItemsBackend();
    const { table } = await openTab();
    const rows = bodyRows(table);

    expect(cellText(rows[0] as HTMLElement, 'Status')).toBe('Shown');
    expect(cellText(rows[1] as HTMLElement, 'Status')).toBe('Shown');
    expect(cellText(rows[5] as HTMLElement, 'Status')).toBe('HiddenLine hidden');
    expect(within(rows[0] as HTMLElement).queryByText('Line hidden')).toBeNull();
  });

  it('keeps an item with no line and no pieces to a name alone under the photo', async () => {
    const items = [{ ...(demoGalleryItems()[3] as ReturnType<typeof demoGalleryItems>[number]), lineId: null, lineShortName: null, pieces: null }];
    galleryItemsBackend(items);
    const { table } = await openTab();

    expect(cellText(bodyRows(table)[0] as HTMLElement, 'Photo')).toBe('Sample Old Hoopers');
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

