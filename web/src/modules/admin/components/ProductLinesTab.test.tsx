import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { ProductLinesTab } from '@/modules/admin/components/ProductLinesTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoLineDetail, demoLines, LINE_IDS, productLinesBackend } from '@/test/siteContentFixtures';

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
      screen.getByText(
        'Shown on the Home and Products pages, in this order. The Gallery filters use the short names.',
      ),
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

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Product line',
      'Starts at',
      'Order types',
      'Gallery',
      'Status',
      'Actions',
    ]);
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
    expect(cellText(rows[0] as HTMLElement, 'Starts at')).toBe('₱650.00min. 10 pcs');
    expect(cellText(rows[1] as HTMLElement, 'Starts at')).toBe('Not set');
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
    productLinesBackend([...demoLines().filter((line) => line.id !== LINE_IDS.polo), demoLineDetail('polo', { isActive: false })]);
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
