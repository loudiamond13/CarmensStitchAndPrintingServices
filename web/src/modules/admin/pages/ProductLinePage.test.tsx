import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { ProductLineRoute } from '@/modules/admin/pages/ProductLinePage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoLineDetail, LINE_IDS, lineProductTypesAre, productLinesBackend } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S4 Product line editor, /admin/site-content/products/:lineId (CONT-02, D-04, D-34, PUB-03; plan 11-20): a Manager opens a line, sets a
// price and saves.

// Fourteen fields and axe take longer than the 5 second default on a busy machine.
vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  lineProductTypesAre();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/admin/site-content', element: <p>The Site Content page</p> },
      { path: '/admin/site-content/products/new', element: <ProductLineRoute /> },
      { path: '/admin/site-content/products/:lineId', element: <ProductLineRoute /> },
      { path: '/admin/settings', element: <p>Settings page</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router, user: userEvent.setup() };
}

async function openLine(id: string) {
  const view = renderPage(`/admin/site-content/products/${id}`);
  await screen.findByLabelText(/^Title/);
  return view;
}

const PRICE = /^Starts at, per piece/;
const MINIMUM = /^Minimum order, pieces/;

describe('opening a line (D-34)', () => {
  it('shows the line title as the h1, a back link to the Products tab and the document title', async () => {
    productLinesBackend();
    await openLine(LINE_IDS.basketball);

    expect(screen.getByRole('heading', { level: 1, name: 'Basketball Jerseys' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Site Content' })).toHaveAttribute(
      'href',
      '/admin/site-content?tab=products',
    );
    expect(screen.getByText('Shown on the Home and Products pages.')).toBeVisible();
    expect(document.title).toBe('Basketball Jerseys · CSPS Admin');
  });

  it('has the Names, Words, What you can customize and Price cards filled from the saved line', async () => {
    productLinesBackend();
    await openLine(LINE_IDS.basketball);

    for (const name of ['Names', 'Words', 'What you can customize', 'Price']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Basketball Jerseys');
    expect(screen.getByLabelText(/^Short name/)).toHaveValue('Basketball');
    expect(screen.getByLabelText(/^Number on the drawing/)).toHaveValue('23');
    expect(screen.getByLabelText(/^Card text/)).toHaveValue('Card text of Basketball Jerseys.');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Description of Basketball Jerseys.');
    for (const label of ['Fabric', 'Collar style', 'Cut & fit', 'Names & numbers', 'Logos & sponsors']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeVisible();
    }
    expect(screen.getByLabelText(PRICE)).toHaveValue('650.00');
    expect(screen.getByLabelText(MINIMUM)).toHaveValue('10');
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).toBeChecked();
  });

  it('reads the price to visitors under the fields', async () => {
    productLinesBackend();
    await openLine(LINE_IDS.basketball);

    expect(screen.getByText('Visitors see: Starts at ₱650.00 / pc · min. 10 pcs')).toBeVisible();
  });
});

describe('setting a price (D-04, D-34)', () => {
  it('updates the Visitors see line as 650.00 and 10 are typed', async () => {
    productLinesBackend();
    const { user } = await openLine(LINE_IDS.polo);
    expect(screen.getByText('Visitors see: Message us for a price')).toBeVisible();

    await user.type(screen.getByLabelText(PRICE), '650.00');
    await user.type(screen.getByLabelText(MINIMUM), '10');

    expect(screen.getByText('Visitors see: Starts at ₱650.00 / pc · min. 10 pcs')).toBeVisible();
  });

  it('saves with Save Changes: PUT with the version the form opened with, the toast, and the public data cleared in this browser', async () => {
    const backend = productLinesBackend();
    const { user } = await openLine(LINE_IDS.polo);
    const polo = demoLineDetail('polo');

    await user.type(screen.getByLabelText(PRICE), '450');
    await user.tab();
    expect(screen.getByLabelText(PRICE)).toHaveValue('450.00');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Product line saved')).toBeVisible();
    expect(screen.getByText('The website shows the changes now.')).toBeVisible();
    expect(backend.puts).toHaveLength(1);
    expect(backend.puts[0]).toMatchObject({
      id: LINE_IDS.polo,
      body: { version: polo.version, title: 'Polo Shirts', startsAtPrice: 450, minimumQuantity: null },
    });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    // The page stays on the line, with the saved price.
    expect(screen.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();
    expect(screen.getByLabelText(PRICE)).toHaveValue('450.00');
  });
});

describe('a line that is not there (S4 Not found)', () => {
  it('says so for an id that is not a GUID, without asking the server for anything', async () => {
    const backend = productLinesBackend();
    renderPage('/admin/site-content/products/not-an-id');

    expect(await screen.findByText("This product line wasn't found.")).toBeVisible();
    expect(screen.getByText('It may have been deleted. Go back to the list.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Products' })).toHaveAttribute(
      'href',
      '/admin/site-content?tab=products',
    );
    await waitFor(() => {
      expect(backend.gets).toBe(0);
    });
  });
});
