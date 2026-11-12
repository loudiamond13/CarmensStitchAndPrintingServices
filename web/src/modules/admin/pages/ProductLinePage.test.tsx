import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { ProductLineRoute } from '@/modules/admin/pages/ProductLinePage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoLineDetail,
  demoLines,
  LINE_IDS,
  LINE_TYPE_IDS,
  lineProductTypesAre,
  lineWithPhotos,
  problemAnswer,
  productLinesBackend,
} from '@/test/siteContentFixtures';

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

  it('says so for a valid id the server does not know, after the 404', async () => {
    const backend = productLinesBackend();
    renderPage('/admin/site-content/products/8c1f4a20-0000-4000-8000-0000000000ff');

    expect(await screen.findByText("This product line wasn't found.")).toBeVisible();
    expect(backend.gets).toBe(1);
  });
});

/** The demo lines but one, so a test can put its own version of that line in. */
function linesWithout(key: keyof typeof LINE_IDS) {
  return demoLines().filter((line) => line.id !== LINE_IDS[key]);
}

/** The words the five customize fields and the required texts take in a new line. */
async function fillNewLine(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/^Title/), 'Cycling Jerseys');
  await user.type(screen.getByLabelText(/^Short name/), 'Cycling');
  await user.type(screen.getByLabelText(/^Card text/), 'For every ride.');
  await user.type(screen.getByLabelText(/^Description/), 'Jerseys for riders.');
  await user.type(screen.getByLabelText(/^Fabric/), 'Light fabric.');
  await user.type(screen.getByLabelText(/^Collar style/), 'Zip collar.');
  await user.type(screen.getByLabelText(/^Cut & fit/), 'Slim cut.');
  await user.type(screen.getByLabelText(/^Names & numbers/), 'Any font.');
  await user.type(screen.getByLabelText(/^Logos & sponsors/), 'Sponsor logos.');
}

async function openNewLine() {
  const view = renderPage('/admin/site-content/products/new');
  await screen.findByLabelText(/^Title/);
  return view;
}

describe('adding a line (D-01, CONT-02)', () => {
  it('opens the New Product Line editor with Show on the website unticked and the save-first note in place of the photos', async () => {
    productLinesBackend();
    await openNewLine();

    expect(screen.getByRole('heading', { level: 1, name: 'New Product Line' })).toBeVisible();
    expect(document.title).toBe('New Product Line · CSPS Admin');
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 2, name: 'Photos' })).toBeVisible();
    expect(screen.getByText('Save the product line first, then add photos.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Product Line' })).toBeVisible();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('shows the Photos card with its three slots and no save-first note on a line that exists (plan 11-22)', async () => {
    productLinesBackend([lineWithPhotos('polo', ['main'])]);
    await openLine(LINE_IDS.polo);

    expect(screen.getByRole('heading', { level: 2, name: 'Photos' })).toBeVisible();
    expect(screen.queryByText('Save the product line first, then add photos.')).toBeNull();
    const main = screen.getByRole('group', { name: 'Main photo' });
    expect(within(main).getByRole('img', { name: 'Main photo of Polo Shirts' })).toBeVisible();
    expect(within(main).getByRole('button', { name: 'Replace Photo' })).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Back view' })).getByRole('button', { name: 'Choose Photo' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Fabric detail' })).getByRole('button', { name: 'Choose Photo' }),
    ).toBeVisible();
  });

  it('saves a new line with POST, no version and one Idempotency-Key, then replaces the address with the new line editor and says it is hidden', async () => {
    const backend = productLinesBackend();
    const { user, router } = await openNewLine();
    await fillNewLine(user);

    await user.click(screen.getByRole('button', { name: 'Save Product Line' }));

    expect(await screen.findByText('Product line added')).toBeVisible();
    expect(screen.getByText("It's hidden until you tick Show on the website.")).toBeVisible();
    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.key).toMatch(/\S/);
    expect(backend.posts[0]?.body).toMatchObject({
      version: null,
      title: 'Cycling Jerseys',
      shortName: 'Cycling',
      isActive: false,
      startsAtPrice: null,
      minimumQuantity: null,
    });
    const made = backend.lines.at(-1);
    expect(router.state.location.pathname).toBe(`/admin/site-content/products/${made?.id ?? ''}`);
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cycling Jerseys' })).toBeVisible();
    expect(screen.getByText('Hidden')).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('says the line is on the website now when Show on the website was ticked', async () => {
    productLinesBackend();
    const { user } = await openNewLine();
    await fillNewLine(user);
    await user.click(screen.getByRole('checkbox', { name: 'Show on the website' }));

    await user.click(screen.getByRole('button', { name: 'Save Product Line' }));

    expect(await screen.findByText("It's on the website now.")).toBeVisible();
  });

  it('refuses an empty form before any request, flags every required field and puts focus on the first', async () => {
    const backend = productLinesBackend();
    const { user } = await openNewLine();

    await user.click(screen.getByRole('button', { name: 'Save Product Line' }));

    expect(await screen.findByText('Enter the title.')).toBeVisible();
    for (const message of [
      'Enter a short name.',
      'Enter the card text.',
      'Enter the description.',
      'Enter the Fabric text.',
      'Enter the Collar style text.',
      'Enter the Cut & fit text.',
      'Enter the Names & numbers text.',
      'Enter the Logos & sponsors text.',
    ]) {
      expect(screen.getByText(message)).toBeVisible();
    }
    expect(screen.getByLabelText(/^Title/)).toHaveFocus();
    expect(backend.posts).toHaveLength(0);
  });

  it('puts a duplicate short name from the server under Short name, with focus there', async () => {
    productLinesBackend(undefined, {
      onPost: () =>
        problemAnswer(400, { errors: { shortName: ['Another product line already uses this short name.'] } }),
    });
    const { user } = await openNewLine();
    await fillNewLine(user);

    await user.click(screen.getByRole('button', { name: 'Save Product Line' }));

    expect(await screen.findByText('Another product line already uses this short name.')).toBeVisible();
    expect(screen.getByLabelText(/^Short name/)).toHaveFocus();
    expect(screen.getByLabelText(/^Short name/)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('the Order product types card (D-09)', () => {
  it('lists the active order product types A to Z, one checkbox each, with the ones filed under another line named', async () => {
    productLinesBackend();
    await openLine(LINE_IDS.polo);

    const group = await screen.findByRole('group', { name: 'Order product types filed here' });
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual([
      'Basketball Jersey (now under Basketball Jerseys)',
      'Cycling Jersey',
      'Volleyball Jersey (now under Volleyball Jerseys)',
    ]);
    expect(screen.queryByText(/Old Style Jersey/)).toBeNull();
    expect(
      screen.getByText(
        'Orders with these product types are filed under this line when staff show them on the website.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('A product type belongs to one line. Ticking one from another line moves it here.'),
    ).toBeVisible();
  });

  it('ticks the types already filed under this line and gives them no "now under" words', async () => {
    productLinesBackend();
    await openLine(LINE_IDS.basketball);

    expect(await screen.findByRole('checkbox', { name: 'Basketball Jersey' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cycling Jersey' })).not.toBeChecked();
  });

  it('files a type from another line here on save: its id goes in productTypeIds', async () => {
    const backend = productLinesBackend();
    const { user } = await openLine(LINE_IDS.polo);

    await user.click(await screen.findByRole('checkbox', { name: /^Volleyball Jersey/ }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Product line saved')).toBeVisible();
    expect(backend.puts[0]?.body.productTypeIds).toEqual([LINE_TYPE_IDS.volleyball]);
  });

  it('keeps a retired product type that is filed under the line even though the checklist does not show it', async () => {
    const backend = productLinesBackend([
      ...linesWithout('moto'),
      demoLineDetail('moto', { productTypeIds: [LINE_TYPE_IDS.old] }),
    ]);
    const { user } = await openLine(LINE_IDS.moto);

    await user.click(await screen.findByRole('checkbox', { name: 'Cycling Jersey' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Product line saved')).toBeVisible();
    expect([...(backend.puts[0]?.body.productTypeIds ?? [])].sort()).toEqual(
      [LINE_TYPE_IDS.cycling, LINE_TYPE_IDS.old].sort(),
    );
  });

  it('says there are no order product types yet and links to Settings', async () => {
    lineProductTypesAre([]);
    productLinesBackend();
    await openLine(LINE_IDS.polo);

    expect(await screen.findByText(/No order product types yet\. Add them in/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.queryByRole('group', { name: 'Order product types filed here' })).toBeNull();
  });

  it('names every type as filed under another line while adding a new line', async () => {
    productLinesBackend();
    await openNewLine();

    const group = await screen.findByRole('group', { name: 'Order product types filed here' });
    await waitFor(() => {
      expect(
        within(group)
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')?.textContent),
      ).toEqual([
        'Basketball Jersey (now under Basketball Jerseys)',
        'Cycling Jersey',
        'Volleyball Jersey (now under Volleyball Jerseys)',
      ]);
    });
    for (const box of within(group).getAllByRole('checkbox')) {
      expect(box).not.toBeChecked();
    }
  });
});

describe('the record, the Hidden badge and the 409 banner (S4)', () => {
  it('shows who last changed the line and when, under the cards', async () => {
    productLinesBackend([
      ...linesWithout('polo'),
      demoLineDetail('polo', { updatedByName: 'Carmen Reyes', updatedAtUtc: '2026-10-07T03:00:00Z' }),
    ]);
    await openLine(LINE_IDS.polo);

    expect(screen.getByText('Last changed by')).toBeVisible();
    expect(screen.getByText(/Carmen Reyes/)).toBeVisible();
  });

  it('shows the Hidden badge beside the title, outside the h1, while the line is hidden', async () => {
    productLinesBackend([...linesWithout('polo'), demoLineDetail('polo', { isActive: false })]);
    await openLine(LINE_IDS.polo);

    const heading = screen.getByRole('heading', { level: 1, name: 'Polo Shirts' });
    expect(within(heading).queryByText('Hidden')).toBeNull();
    expect(within(heading.parentElement ?? document.body).getByText('Hidden')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
  });

  it('shows the ConflictBanner above the first card on a stale save and keeps the typed values', async () => {
    const backend = productLinesBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    const { user } = await openLine(LINE_IDS.polo);
    await user.type(screen.getByLabelText(PRICE), '450');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('This was changed by someone else.')).toBeVisible();
    expect(screen.getByLabelText(PRICE)).toHaveValue('450.00');
    expect(backend.puts).toHaveLength(1);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
    const firstCard = screen.getByRole('heading', { level: 2, name: 'Names' }).closest('section');
    expect(banner.compareDocumentPosition(firstCard as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it('asks Discard changes? on Load Latest, then replaces what was typed and the version with the saved line', async () => {
    const backend = productLinesBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    const { user } = await openLine(LINE_IDS.polo);
    await user.type(screen.getByLabelText(PRICE), '450');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Load Latest' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    backend.lines = backend.lines.map((line) =>
      line.id === LINE_IDS.polo
        ? { ...line, title: 'Polo Shirts v2', startsAtPrice: 500, version: 'AAAAAAAAG99=' }
        : line,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Discard Changes' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Title/)).toHaveValue('Polo Shirts v2');
    });
    expect(screen.getByLabelText(PRICE)).toHaveValue('500.00');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();
  });
});

describe('leaving the editor with unsaved changes (08 D-58)', () => {
  it('asks Discard changes? on the back link when something was typed, and Keep Editing stays', async () => {
    productLinesBackend();
    const { user, router } = await openLine(LINE_IDS.polo);
    await user.type(screen.getByLabelText(/^Title/), ' X');

    await user.click(screen.getByRole('link', { name: 'Site Content' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    expect(router.state.location.pathname).toBe(`/admin/site-content/products/${LINE_IDS.polo}`);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Polo Shirts X');
  });

  it('leaves for the Products tab on Discard Changes, and on Cancel after the same question', async () => {
    productLinesBackend();
    const { user, router } = await openLine(LINE_IDS.polo);
    await user.type(screen.getByLabelText(/^Title/), ' X');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Discard Changes',
      }),
    );

    expect(await screen.findByText('The Site Content page')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/site-content');
    expect(router.state.location.search).toBe('?tab=products');
  });

  it('leaves at once when nothing was changed, and after a save', async () => {
    productLinesBackend();
    const { user, router } = await openLine(LINE_IDS.polo);
    await user.type(screen.getByLabelText(/^Title/), ' X');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Product line saved');

    await user.click(screen.getByRole('link', { name: 'Site Content' }));

    expect(await screen.findByText('The Site Content page')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/site-content');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sets beforeunload only while there are unsaved changes', async () => {
    productLinesBackend();
    const { user } = await openLine(LINE_IDS.polo);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText(/^Title/), ' X');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);

    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('accessibility (S4)', () => {
  it('has no axe violations on a new line', async () => {
    productLinesBackend();
    const { container } = await openNewLine();

    await expectNoAxeViolations(container);
  });

  it('has no axe violations on a line that exists', async () => {
    productLinesBackend();
    const { container } = await openLine(LINE_IDS.basketball);

    await expectNoAxeViolations(container);
  });

  it('has no axe violations on an id that is not one, and on a line the server does not know', async () => {
    productLinesBackend();
    const invalid = renderPage('/admin/site-content/products/not-an-id');
    await screen.findByText("This product line wasn't found.");
    await expectNoAxeViolations(invalid.container);
    invalid.unmount();

    const unknown = renderPage('/admin/site-content/products/8c1f4a20-0000-4000-8000-0000000000ff');
    await screen.findByText("This product line wasn't found.");
    await expectNoAxeViolations(unknown.container);
  });
});
