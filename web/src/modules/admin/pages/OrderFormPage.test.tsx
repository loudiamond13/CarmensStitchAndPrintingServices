import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { dashboardKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { staffMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { photoUploadQueue } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { quoteRequestKey } from '@/modules/admin/hooks/useQuoteRequestQuery';
import OrderFormPage from '@/modules/admin/pages/OrderFormPage';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  buildOrderDetail,
  buildOrderList,
  cancelledOrderWithRefunds,
  completedOrder,
  noDueDateOrder,
  ORDER_STAFF_TWO,
  ORDER_VERSION,
  order0148,
  orderId,
  orderProblem,
  PRODUCT_LINE_OPTIONS,
  publicWebsiteBlock,
  useOrderHandlers,
  type OrderBackend,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { BASKETBALL_ID } from '@/test/orderListFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { quoteRequestDetail, quoteRequestId } from '@/test/quoteRequestFixtures';
import type { components } from '@/types/api.generated';
import { sessionResponse } from '@/test/sessionFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// F1 New Order, /admin/orders/new (ORD-03, ORD-15, D-27, D-30, D-49; plan 08-13): the cards, the checks that run before any
// request, and one save that lands on the new order.

let queryClient: QueryClient;

/** The order the fake API answers a create with. */
const created = buildOrderDetail({ id: orderId(900), number: 'ORD-2026-0900', teamName: 'Test Hawks' });

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  photoUploadQueue.clear(created.id);
  queryClient.clear();
  clearSession();
});

/** The query keys a spy on `invalidateQueries` was asked to read again. */
function invalidatedRoots(spy: { mock: { calls: readonly (readonly unknown[])[] } }): unknown[] {
  return spy.mock.calls.map(([filters]) => (filters as { queryKey?: unknown } | undefined)?.queryKey);
}

interface RenderOptions {
  backend?: OrderBackend;
  /** The navigation state the form was opened with (the list sends `{ from }`). */
  state?: unknown;
  /** The query string the form was opened with, such as `?fromRequest={id}`. */
  search?: string;
  /** Runs before the first render, so a test can watch every navigation. */
  beforeRender?: (router: ReturnType<typeof createMemoryRouter>) => void;
}

/** Opens the form in a data router, with the Orders list and the new order's page as stand-ins to land on. */
function renderForm({ state, search = '', beforeRender }: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/new', element: <OrderFormPage /> },
      { path: '/admin/orders/:id', element: <p>The order page</p> },
      { path: '/admin/quote-requests/:id', element: <p>The quote request page</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: [{ pathname: '/admin/orders/new', search, state }] },
  );
  beforeRender?.(router);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

/** Waits for the form (the business date has arrived) and returns the user. */
async function openForm(options: RenderOptions = {}) {
  const view = renderForm(options);
  await screen.findByRole('heading', { level: 1, name: 'New Order' });
  await screen.findByRole('option', { name: 'Basketball Jersey' });
  return { ...view, user: userEvent.setup() };
}

function setDate(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}

/** Fills every required field with good values. */
async function fillValidOrder(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/^Customer name/), 'Test Customer');
  await user.type(screen.getByLabelText(/^Team \/ organization/), 'Test Hawks');
  await user.type(screen.getByLabelText(/^Contact number/), '0917 000 0000');
  setDate('Due date', '2026-10-20');
  await user.selectOptions(screen.getByLabelText(/^Product type/), 'Basketball Jersey');
  await user.type(screen.getByLabelText(/^Description/), 'Test jersey');
  await user.type(screen.getByLabelText(/^Qty/), '12');
  await user.type(screen.getByLabelText(/^Unit price/), '780');
}

describe('the opening form (D-30, D-49, D-59, D-27)', () => {
  it('shows the New Order header, the cards and a document title', async () => {
    useOrderHandlers();
    await openForm();

    expect(document.title).toBe('New Order · CSPS Admin');
    expect(
      screen.getByText(
        'Customer, dates, images and items. Payments, discounts and expenses are added on the order page after saving.',
      ),
    ).toBeVisible();
    for (const name of ['Customer details', 'Order details', 'Images', 'Order items']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
  });

  it('starts the order date at the server business today, not the device clock', async () => {
    useOrderHandlers();
    await openForm();

    expect(screen.getByLabelText(/^Order date/)).toHaveValue('2026-10-08');
    expect(screen.getByLabelText(/^Due date/)).toHaveValue('');
  });

  it('keeps the form and what was typed while an old day is read again (WR-03)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let reads = 0;
    useOrderHandlers({
      list: async () => {
        reads += 1;
        if (reads > 1) await delay(150);
        return buildOrderList([], { today: '2026-10-08' });
      },
    });
    const { user } = await openForm();
    await user.type(screen.getByLabelText(/^Customer name/), 'Test Customer');

    vi.setSystemTime(Date.now() + 10 * 60_000);
    act(() => {
      void queryClient.invalidateQueries({ queryKey: ['business-today'] });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(reads).toBe(2);
    expect(screen.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Test Customer');
    expect(screen.getByLabelText(/^Order date/)).toHaveValue('2026-10-08');
  });

  it('lists the five active statuses with Pending chosen', async () => {
    useOrderHandlers();
    await openForm();

    const status = screen.getByLabelText(/^Status/);
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Pending', 'Mockup', 'In Production', 'Ready', 'Delivered']);
    expect(status).toHaveValue('pending');
    expect(screen.getByText('Completed and Cancelled are set on the order page.')).toBeVisible();
  });

  it('shows the Images card as the draft photo picker, not the coming-soon text (D-09, UIC-3)', async () => {
    useOrderHandlers();
    const { container } = await openForm();

    expect(screen.queryByText('Image uploads are coming soon.')).not.toBeInTheDocument();
    expect(screen.getByText('Mockups and reference photos. They upload after you save the order.')).toBeVisible();
    expect(container.querySelector('input[type="file"][multiple]')).not.toBeNull();
    expect((await screen.findAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'Order photos' })).not.toBeInTheDocument();
  });

  it('offers a back link to the list the person came from, else to Orders (D-51)', async () => {
    useOrderHandlers();
    const { unmount } = await openForm({ state: { from: '/admin/orders?status=ready&view=table' } });
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'href',
      '/admin/orders?status=ready&view=table',
    );
    unmount();

    await openForm({ state: { from: 'https://elsewhere.example/phish' } });
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders');
  });
});

describe('the checks before any request (OR-3)', () => {
  it("shows the server's words and sends nothing for an empty form", async () => {
    const backend = useOrderHandlers();
    const { user } = await openForm();

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText("Enter the customer's name.")).toBeVisible();
    expect(screen.getByText('Enter a contact number.')).toBeVisible();
    expect(screen.getByText('Enter the due date.')).toBeVisible();
    expect(screen.getByText('Choose a product type.')).toBeVisible();
    expect(screen.getByText('Describe the item.')).toBeVisible();
    expect(screen.getByText('Enter a quantity from 1 to 10,000.')).toBeVisible();
    expect(screen.getByText('Enter a unit price.')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
    // Focus goes to the first invalid field.
    expect(screen.getByLabelText(/^Customer name/)).toHaveFocus();
  });

  it('rejects a contact number with letters', async () => {
    const backend = useOrderHandlers();
    const { user } = await openForm();
    await fillValidOrder(user);
    await user.clear(screen.getByLabelText(/^Contact number/));
    await user.type(screen.getByLabelText(/^Contact number/), 'abc');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('Use digits, spaces and + - ( ) only.')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
  });

  it('rejects a due date before the order date', async () => {
    const backend = useOrderHandlers();
    const { user } = await openForm();
    await fillValidOrder(user);
    setDate('Due date', '2026-10-07');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText("The due date can't be before the order date.")).toBeVisible();
    expect(backend.writes).toHaveLength(0);
  });

  it('says how many days are between the dates once both are real', async () => {
    useOrderHandlers();
    await openForm();

    setDate('Due date', '2026-10-20');
    expect(await screen.findByText('12 days from order date')).toBeVisible();
    setDate('Due date', '2026-10-08');
    expect(await screen.findByText('Same day as the order date')).toBeVisible();
  });
});

describe('saving (ORD-03, SEC-06)', () => {
  it('posts the order once with an Idempotency-Key, lands on its page and toasts', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user, router } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${created.id}`);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('POST');
    expect(write?.path).toBe('/orders');
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.body).toEqual({
      customerName: 'Test Customer',
      teamName: 'Test Hawks',
      contactNumber: '0917 000 0000',
      email: null,
      address: null,
      orderDate: '2026-10-08',
      dueDate: '2026-10-20',
      status: 'pending',
      notes: null,
      items: [
        {
          productTypeId: BASKETBALL_ID,
          description: 'Test jersey',
          sizeVariant: null,
          quantity: 12,
          unitPrice: 780,
        },
      ],
    });
    expect(await screen.findByText('Order saved')).toBeVisible();
    expect(screen.getByText('ORD-2026-0900 · Test Hawks')).toBeVisible();
  });

  it('sends one request for a double click', async () => {
    const backend = useOrderHandlers({
      detail: created,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return HttpResponse.json(created, { status: 201 });
      },
    });
    const { user } = await openForm();
    await fillValidOrder(user);
    const save = screen.getByRole('button', { name: 'Save Order' });

    await user.dblClick(save);

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(1);
  });

  it('retries a network failure with the same Idempotency-Key', async () => {
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: created,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : undefined;
      },
    });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Order' })).not.toHaveAttribute('aria-disabled', 'true');
    });
    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(2);
    expect(backend.writes[1]?.key).toBe(backend.writes[0]?.key);
  });
});

describe('the Public website card on the New Order form (UI-SPEC F1; D-11, D-16; plan 11-35)', () => {
  const BASKETBALL_LINE = PRODUCT_LINE_OPTIONS[0]?.id ?? '';

  /** Waits for the line options the card offers. */
  async function openFormWithLines() {
    const view = await openForm();
    await screen.findByRole('option', { name: 'Basketball Jerseys' });
    return view;
  }

  async function tickOkAndShow(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(screen.getByRole('checkbox', { name: 'Show on the website' }));
  }

  it('sits after Order details and before Images, with its hint and no preview', async () => {
    useOrderHandlers();
    await openFormWithLines();

    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(titles.indexOf('Public website')).toBe(titles.indexOf('Order details') + 1);
    expect(titles.indexOf('Images')).toBe(titles.indexOf('Public website') + 1);
    expect(screen.getByText("Only with the customer's OK.")).toBeVisible();
    expect(screen.queryByText(/^Visitors see:/)).toBeNull();
  });

  it('starts with both boxes unticked (D-11)', async () => {
    useOrderHandlers();
    await openFormWithLines();

    expect(screen.getByRole('checkbox', { name: 'Customer said OK to show' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('posts the OK and Show with no line and no name when both are ticked', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openFormWithLines();
    await fillValidOrder(user);
    await tickOkAndShow(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(1);
    expect((backend.writes[0]?.body as { publicWebsite?: unknown }).publicWebsite).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: null,
      publicName: null,
    });
  });

  it('posts the line and the trimmed name when they are set', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openFormWithLines();
    await fillValidOrder(user);
    await tickOkAndShow(user);
    await user.selectOptions(screen.getByLabelText(/^Show under/), BASKETBALL_LINE);
    await user.type(screen.getByLabelText(/^Name shown/), '  Test Hawks MC  ');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect((backend.writes[0]?.body as { publicWebsite?: unknown }).publicWebsite).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: BASKETBALL_LINE,
      publicName: 'Test Hawks MC',
    });
  });

  it('sends no publicWebsite block when the card was left alone, or ticked and unticked again', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openFormWithLines();
    await fillValidOrder(user);
    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes[0]?.body).not.toHaveProperty('publicWebsite');
  });

  it('needs a name to show an order that has no team, and sends nothing until it has one', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openFormWithLines();
    await fillValidOrder(user);
    await user.clear(screen.getByLabelText(/^Team \/ organization/));
    await tickOkAndShow(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name shown/)).toBeInvalid();
    });
    expect(screen.getByLabelText(/^Name shown/)).toHaveFocus();
    expect(backend.writes).toHaveLength(0);
  });

  it('counts a change in the card for the Discard changes? guard (ORD-15)', async () => {
    useOrderHandlers();
    const { user } = await openFormWithLines();
    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  });

  it('puts a server 400 under publicWebsite.productLineId under Show under and focuses it', async () => {
    useOrderHandlers({
      reply: () =>
        HttpResponse.json(
          {
            title: 'x',
            status: 400,
            errors: { 'publicWebsite.productLineId': ['Choose the product line to show this order under.'] },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const { user } = await openFormWithLines();
    await fillValidOrder(user);
    await tickOkAndShow(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('Choose the product line to show this order under.')).toBeVisible();
    expect(screen.getByLabelText(/^Show under/)).toHaveFocus();
  });

  it('has no axe violations with the card in each state', async () => {
    useOrderHandlers();
    const { container, user } = await openFormWithLines();
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('checkbox', { name: 'Show on the website' }));
    await expectNoAxeViolations(container);
  });
});

describe('the summary aside and the item grid on the page (UIC-51)', () => {
  it('shows the live summary: status, due date, line items, pieces and the total preview', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    await fillValidOrder(user);

    const aside = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(aside).getByText('Updates as you edit items')).toBeVisible();
    expect(within(aside).getByText('Pending')).toBeVisible();
    expect(within(aside).getByText('Oct 20, 2026')).toBeVisible();
    expect(within(aside).getByText('Line items').nextElementSibling).toHaveTextContent('1');
    expect(within(aside).getByText('Pieces').nextElementSibling).toHaveTextContent('12');
    expect(within(aside).getByText('Total').nextElementSibling).toHaveTextContent('₱9,360.00');
    expect(
      within(aside).getByText('Balance = Total \u2212 Payments. Record the downpayment after saving.'),
    ).toBeVisible();
    // The aside is a preview, not a live region.
    expect(aside.querySelector('[aria-live], [role="status"]')).toBeNull();
    expect(aside).not.toHaveAttribute('aria-live');
  });

  it('follows a change of status and of the items', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.selectOptions(screen.getByLabelText(/^Status/), 'Ready');
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await user.type(within(screen.getByRole('group', { name: 'Item 2' })).getByLabelText(/^Qty/), '3');
    await user.type(within(screen.getByRole('group', { name: 'Item 2' })).getByLabelText(/^Unit price/), '100');

    const aside = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(aside).getByText('Ready')).toBeVisible();
    expect(within(aside).getByText('Line items').nextElementSibling).toHaveTextContent('2');
    expect(within(aside).getByText('Pieces').nextElementSibling).toHaveTextContent('15');
    expect(within(aside).getByText('Total').nextElementSibling).toHaveTextContent('₱9,660.00');
    expect(screen.getByText('15 pcs across 2 line items')).toBeVisible();
  });

  it('puts a server 400 on items[1].quantity under the Qty of row 2 and focuses it', async () => {
    const backend = useOrderHandlers({
      reply: () =>
        HttpResponse.json(
          { title: 'x', status: 400, errors: { 'items[1].quantity': ['Enter a quantity from 1 to 10,000.'] } },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const { user } = await openForm();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    const row2 = screen.getByRole('group', { name: 'Item 2' });
    await user.selectOptions(within(row2).getByLabelText(/^Product type/), 'Basketball Jersey');
    await user.type(within(row2).getByLabelText(/^Description/), 'Shorts');
    await user.type(within(row2).getByLabelText(/^Qty/), '2');
    await user.type(within(row2).getByLabelText(/^Unit price/), '300');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await within(row2).findByText('Enter a quantity from 1 to 10,000.')).toBeVisible();
    expect(within(row2).getByLabelText(/^Qty/)).toHaveFocus();
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByText(/1 field needs attention/)).toBeVisible();
  });

  it('keeps a retired product type out of the picker', async () => {
    useOrderHandlers();
    await openForm();

    const picker = screen.getByLabelText(/^Product type/);
    expect(within(picker).queryByRole('option', { name: /Old Style Jersey/ })).toBeNull();
  });
});

describe('Discard changes before leaving (ORD-15, UIC-42)', () => {
  it('asks before the back link leaves a form with typed values, and Keep Editing returns focus to the link', async () => {
    useOrderHandlers();
    const { user, router } = await openForm();
    await user.type(screen.getByLabelText(/^Customer name/), 'Half filled');
    const back = screen.getByRole('link', { name: 'Orders' });

    await user.click(back);

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(
      within(dialog).getByText("Your changes to this order haven't been saved. If you leave now, they're lost."),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/admin/orders/new');
    expect(back).toHaveFocus();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Half filled');
  });

  it('asks on Cancel when dirty, asks again after Keep Editing, and leaves on Discard Changes', async () => {
    useOrderHandlers();
    const { user, router } = await openForm();
    await user.type(screen.getByLabelText(/^Customer name/), 'Half filled');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Keep Editing' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));

    expect(await screen.findByText('The orders list')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/orders');
  });

  it('counts an item row as a change', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    await user.click(screen.getByRole('button', { name: 'Add Item' }));

    await user.click(screen.getByRole('link', { name: 'Orders' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  });

  it('leaves a clean form at once, on Cancel', async () => {
    useOrderHandlers();
    const { user } = await openForm();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('The orders list')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask once typed values are put back (not dirty)', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    const name = screen.getByLabelText(/^Customer name/);
    await user.type(name, 'abc');
    await user.clear(name);

    await user.click(screen.getByRole('link', { name: 'Orders' }));

    expect(await screen.findByText('The orders list')).toBeVisible();
  });

  it('never asks after a save', async () => {
    useOrderHandlers({ detail: created });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('The order page')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets a sign-out through a dirty form', async () => {
    useOrderHandlers();
    const { user, router } = await openForm();
    await user.type(screen.getByLabelText(/^Customer name/), 'Half filled');

    await act(async () => {
      await router.navigate('/admin/login');
    });

    expect(await screen.findByText('Sign-in page')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks the browser for its own prompt on reload or close only while the form is dirty', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    const clean = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(clean);
    });
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText(/^Customer name/), 'Half filled');
    const dirty = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(dirty);
    });

    expect(dirty.defaultPrevented).toBe(true);
  });

  it('cannot be left through the dialog while a save is pending, and lands on the order when the save ends', async () => {
    const backend = useOrderHandlers({
      detail: created,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json(created, { status: 201 });
      },
    });
    const { user, router } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await user.click(screen.getByRole('link', { name: 'Orders' }));
    const discard = await screen.findByRole('button', { name: 'Discard Changes' });
    await user.click(discard);

    expect(router.state.location.pathname).toBe('/admin/orders/new');
    await screen.findByText('The order page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${created.id}`);
    expect(backend.writes).toHaveLength(1);
  });
});

describe('busy orders and the save bar (UIC-21)', () => {
  it('shows the busy banner above the first card, keeps the values, and retries with the same key', async () => {
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: created,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? orderProblem(409, 'orders.busy') : undefined;
      },
    });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    const banner = await screen.findByText('Orders are being saved right now.');
    expect(banner).toBeVisible();
    expect(screen.getByText('Try again in a moment.')).toBeVisible();
    const firstCard = screen.getByRole('heading', { level: 2, name: 'Customer details' });
    expect(banner.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Test Customer');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Test jersey');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(2);
    expect(backend.writes[1]?.key).toBe(backend.writes[0]?.key);
  });

  it('shows a danger toast for a failure no field shows', async () => {
    useOrderHandlers({ reply: () => orderProblem(500) });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('Something went wrong')).toBeVisible();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Test Customer');
  });

  it('reads the order lists, the staff money and the dashboard again after a create that may have saved', async () => {
    useOrderHandlers({ reply: () => orderProblem(500) });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('Something went wrong');
    expect(invalidatedRoots(spy)).toEqual(expect.arrayContaining([ordersKey, staffMoneyKey, dashboardKey]));
  });

  it('reads nothing again after a create the server refused (400 with no field shown)', async () => {
    useOrderHandlers({ reply: () => orderProblem(400) });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Order' })).toBeEnabled();
    });
    expect(invalidatedRoots(spy)).toEqual([]);
  });

  it('reads Unsaved changes once something is typed, and nothing on a clean form', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    expect(screen.queryByText('Unsaved changes')).toBeNull();

    await user.type(screen.getByLabelText(/^Customer name/), 'x');

    expect(screen.getByText('Unsaved changes')).toBeVisible();
  });

  it('counts the fields that need attention', async () => {
    useOrderHandlers();
    const { user } = await openForm();
    await fillValidOrder(user);
    await user.clear(screen.getByLabelText(/^Contact number/));
    await user.type(screen.getByLabelText(/^Contact number/), 'abc');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    expect(await screen.findByText('1 field needs attention · unsaved changes')).toBeVisible();

    await user.clear(screen.getByLabelText(/^Customer name/));
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    expect(await screen.findByText('2 fields need attention · unsaved changes')).toBeVisible();
  });

  it('reads Saving while the request runs', async () => {
    useOrderHandlers({
      detail: created,
      reply: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(created, { status: 201 });
      },
    });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findAllByText('Saving')).toHaveLength(2);
    await screen.findByText('The order page');
  });
});

// F2 Edit Order, /admin/orders/:id/edit (ORD-15, D-28, D-46, SEC-08; plan 08-15): customer details, dates and notes only, saved
// with the version the form opened with.

/** Opens the edit form in a data router, with the order page and the Orders list as stand-ins to land on. */
function renderEdit({ detail = order0148 }: { detail?: OrderDetailFixture } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/:id/edit', element: <OrderFormPage /> },
      { path: '/admin/orders/:id', element: <p>The order page</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: [`/admin/orders/${detail.id}/edit`] },
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

/** Waits for the order to fill the form, and returns the user. */
async function openEdit(options: { detail?: OrderDetailFixture } = {}) {
  const view = renderEdit(options);
  await screen.findByRole('heading', { level: 1, name: 'Edit Order' });
  await screen.findByLabelText(/^Customer name/);
  return { ...view, user: userEvent.setup() };
}

describe('the edit form (D-28, D-46, SEC-08)', () => {
  it('shows the details cards without Status, Images or Items, under a title with the order number', async () => {
    useOrderHandlers();
    await openEdit();

    expect(document.title).toBe('Edit ORD-2026-0148 · CSPS Admin');
    expect(
      screen.getByText(
        'Customer details, dates and notes. Items, payments, discounts and expenses are changed on the order page.',
      ),
    ).toBeVisible();
    for (const name of ['Customer details', 'Order details']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    for (const name of ['Images', 'Order items']) {
      expect(screen.queryByRole('heading', { level: 2, name })).toBeNull();
    }
    expect(screen.queryByLabelText(/^Status/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Item' })).toBeNull();
    expect(screen.getByLabelText(/^Notes/)).toBeVisible();
  });

  it("fills every box with the order's own values and links back to the order by its number", async () => {
    useOrderHandlers();
    await openEdit();

    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByLabelText(/^Team \/ organization/)).toHaveValue('Brgy. San Roque Ballers');
    expect(screen.getByLabelText(/^Contact number/)).toHaveValue('0917 123 4567');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('juan.dc@example.ph');
    expect(screen.getByLabelText(/^Address/)).toHaveValue('Brgy. San Roque, Marikina City');
    expect(screen.getByLabelText(/^Order date/)).toHaveValue('2026-09-28');
    expect(screen.getByLabelText(/^Due date/)).toHaveValue('2026-10-14');
    expect(screen.getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/${order0148.id}`,
    );
  });

  it('shows the order number, its status and who recorded and last changed it in the Summary', async () => {
    const detail = buildOrderDetail({ lastChangedBy: ORDER_STAFF_TWO, lastChangedAt: '2026-10-03T06:15:00Z' });
    useOrderHandlers({ detail });
    await openEdit({ detail });

    const aside = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(aside).getByText('ORD-2026-0148')).toBeVisible();
    expect(within(aside).getByText('In Production')).toBeVisible();
    expect(within(aside).getByText('Recorded by')).toBeVisible();
    expect(within(aside).getByText('Last changed by')).toBeVisible();
    expect(within(aside).getByText(/Carmen Reyes/)).toBeVisible();
    expect(within(aside).getByText(new RegExp(ORDER_STAFF_TWO.name))).toBeVisible();
  });

  it('has Cancel and Save Changes in the save bar', async () => {
    useOrderHandlers();
    await openEdit();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save Order' })).toBeNull();
  });
});

describe('saving the details (ORD-15, SEC-07)', () => {
  it('PUTs the details with the version the form opened with, lands on the order and toasts', async () => {
    const backend = useOrderHandlers();
    const { user, router } = await openEdit();
    const contact = screen.getByLabelText(/^Contact number/);
    await user.clear(contact);
    await user.type(contact, '0917 999 8888');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('The order page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${order0148.id}`);
    expect(backend.writes).toHaveLength(1);
    const [write] = backend.writes;
    expect(write?.method).toBe('PUT');
    expect(write?.path).toBe(`/orders/${order0148.id}`);
    expect(write?.key).toBeNull();
    expect(write?.body).toEqual({
      customerName: 'Juan Dela Cruz',
      teamName: 'Brgy. San Roque Ballers',
      contactNumber: '0917 999 8888',
      email: 'juan.dc@example.ph',
      address: 'Brgy. San Roque, Marikina City',
      orderDate: '2026-09-28',
      dueDate: '2026-10-14',
      notes: order0148.notes,
      version: ORDER_VERSION,
    });
    expect(await screen.findByText('Order details saved')).toBeVisible();
    expect(screen.getByText('ORD-2026-0148')).toBeVisible();
  });

  it('reads the order, the lists, the staff money and the dashboard again after a save that may have run', async () => {
    useOrderHandlers({ reply: () => orderProblem(500) });
    const { user } = await openEdit();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('Something went wrong');
    expect(invalidatedRoots(spy)).toEqual(
      expect.arrayContaining([orderKey(order0148.id), ordersKey, staffMoneyKey, dashboardKey]),
    );
  });

  it('reads nothing again after a stale save (409)', async () => {
    useOrderHandlers({ reply: () => orderProblem(409, 'edit.stale') });
    const { user } = await openEdit();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByRole('button', { name: 'Load Latest' });
    expect(invalidatedRoots(spy)).toEqual([]);
  });

  it("shows the server's words and sends nothing for a contact number with letters", async () => {
    const backend = useOrderHandlers();
    const { user } = await openEdit();
    const contact = screen.getByLabelText(/^Contact number/);
    await user.clear(contact);
    await user.type(contact, 'abc');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Use digits, spaces and + - ( ) only.')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
    expect(contact).toHaveFocus();
  });
});

describe('the Public website card on the Edit Order form (UI-SPEC F2; D-11, D-13, D-16; plan 11-35)', () => {
  const BASKETBALL_LINE = PRODUCT_LINE_OPTIONS[0]?.id ?? '';
  const SHOWN = buildOrderDetail({
    publicWebsite: publicWebsiteBlock({
      customerConsent: true,
      consentRecordedAtUtc: '2026-10-08T03:00:00Z',
      consentRecordedByName: 'Liza Mercado',
      shownOnWebsite: true,
      shownSinceUtc: '2026-10-08T03:00:00Z',
      productLineId: BASKETBALL_LINE,
      productLineTitle: 'Basketball Jerseys',
      autoProductLineId: BASKETBALL_LINE,
      publicName: 'Riders MC',
      hasPhoto: true,
    }),
  });

  async function openEditWithLines(detail: OrderDetailFixture = order0148) {
    const view = await openEdit({ detail });
    await screen.findByRole('option', { name: 'Basketball Jerseys' });
    return view;
  }

  it('is the last card, after Order details, with its hint', async () => {
    useOrderHandlers();
    await openEditWithLines();

    // The Summary aside follows the cards of the form column.
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual(['Customer details', 'Order details', 'Public website', 'Summary']);
    expect(screen.getByText("Only with the customer's OK.")).toBeVisible();
    expect(screen.queryByText(/^Visitors see:/)).toBeNull();
  });

  it('is filled from the order', async () => {
    useOrderHandlers({ detail: SHOWN });
    await openEditWithLines(SHOWN);

    expect(screen.getByRole('checkbox', { name: 'Customer said OK to show' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).toBeChecked();
    expect(screen.getByLabelText(/^Show under/)).toHaveValue(BASKETBALL_LINE);
    expect(screen.getByLabelText(/^Name shown/)).toHaveValue('Riders MC');
  });

  it('keeps both boxes unticked for an order that was never shown, with the line the items gave', async () => {
    const detail = buildOrderDetail({ publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL_LINE }) });
    useOrderHandlers({ detail });
    await openEditWithLines(detail);

    expect(screen.getByRole('checkbox', { name: 'Customer said OK to show' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
    expect(screen.getByLabelText(/^Show under/)).toHaveValue(BASKETBALL_LINE);
  });

  it('unticks Show when the OK is unticked', async () => {
    useOrderHandlers({ detail: SHOWN });
    const { user } = await openEditWithLines(SHOWN);

    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));

    expect(screen.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
  });

  it('sends no block with a details save when the card was not touched', async () => {
    const backend = useOrderHandlers({ detail: SHOWN });
    const { user } = await openEditWithLines(SHOWN);
    const contact = screen.getByLabelText(/^Contact number/);
    await user.clear(contact);
    await user.type(contact, '0917 999 8888');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('The order page');
    expect(backend.writes[0]?.body).not.toHaveProperty('publicWebsite');
  });

  it('sends the whole block with the details when the name shown was changed', async () => {
    const backend = useOrderHandlers({ detail: SHOWN });
    const { user } = await openEditWithLines(SHOWN);
    const name = screen.getByLabelText(/^Name shown/);
    await user.clear(name);
    await user.type(name, 'Riders Motorcycle Club');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(1);
    expect((backend.writes[0]?.body as { publicWebsite?: unknown }).publicWebsite).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: BASKETBALL_LINE,
      publicName: 'Riders Motorcycle Club',
    });
  });

  it('sends an all-off block when the OK is taken back', async () => {
    const backend = useOrderHandlers({ detail: SHOWN });
    const { user } = await openEditWithLines(SHOWN);
    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('The order page');
    expect(
      (backend.writes[0]?.body as { publicWebsite?: { customerConsent: boolean; showOnWebsite: boolean } })
        .publicWebsite,
    ).toMatchObject({
      customerConsent: false,
      showOnWebsite: false,
    });
  });

  it('asks for a name when the team is cleared on a shown order that has no name of its own', async () => {
    const detail = buildOrderDetail({
      publicWebsite: publicWebsiteBlock({
        customerConsent: true,
        shownOnWebsite: true,
        productLineId: BASKETBALL_LINE,
        productLineTitle: 'Basketball Jerseys',
      }),
    });
    const backend = useOrderHandlers({ detail });
    const { user } = await openEditWithLines(detail);
    await user.clear(screen.getByLabelText(/^Team \/ organization/));

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name shown/)).toBeInvalid();
    });
    expect(backend.writes).toHaveLength(0);
  });

  it('puts a server 400 under publicWebsite.publicName under Name shown and focuses it', async () => {
    useOrderHandlers({
      detail: SHOWN,
      reply: () =>
        HttpResponse.json(
          {
            title: 'x',
            status: 400,
            errors: { 'publicWebsite.publicName': ['Keep the name to 80 characters or fewer.'] },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const { user } = await openEditWithLines(SHOWN);
    await user.type(screen.getByLabelText(/^Name shown/), ' Club');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Keep the name to 80 characters or fewer.')).toBeVisible();
    expect(screen.getByLabelText(/^Name shown/)).toHaveFocus();
  });

  it('counts a change in the card for the Discard changes? guard (ORD-15)', async () => {
    useOrderHandlers({ detail: SHOWN });
    const { user } = await openEditWithLines(SHOWN);
    await user.type(screen.getByLabelText(/^Name shown/), 'x');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  });

  it('shows the locked banner when the order was cancelled meanwhile (422 orders.public-cancelled)', async () => {
    let current: OrderDetailFixture = SHOWN;
    useOrderHandlers({
      detail: () => current,
      reply: () => {
        current = cancelledOrderWithRefunds;
        return orderProblem(422, 'orders.public-cancelled');
      },
    });
    const { user } = await openEditWithLines(SHOWN);
    await user.type(screen.getByLabelText(/^Name shown/), 'x');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('This order is cancelled.')).toBeVisible();
    expect(screen.queryByLabelText(/^Name shown/)).toBeNull();
  });

  it('fills the card again from the latest order on Load Latest', async () => {
    const newer = buildOrderDetail({
      version: 'AAAAAAAAB9F=',
      publicWebsite: publicWebsiteBlock({
        customerConsent: true,
        shownOnWebsite: true,
        productLineId: BASKETBALL_LINE,
        productLineTitle: 'Basketball Jerseys',
        publicName: 'Riders Renamed',
      }),
    });
    let current: OrderDetailFixture = SHOWN;
    useOrderHandlers({
      detail: () => current,
      reply: () => {
        current = newer;
        return orderProblem(409, 'edit.stale');
      },
    });
    const { user } = await openEditWithLines(SHOWN);
    await user.type(screen.getByLabelText(/^Name shown/), 'x');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name shown/)).toHaveValue('Riders Renamed');
    });
  });

  it('has no axe violations with the card in each state', async () => {
    useOrderHandlers({ detail: SHOWN });
    const { container, user } = await openEditWithLines(SHOWN);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('checkbox', { name: 'Customer said OK to show' }));
    await expectNoAxeViolations(container);
  });
});

describe('stale saves, loading and missing orders (ORD-08, UIC-14, UIC-20)', () => {
  /** The same order after someone else saved it: a new name and a new row version. */
  const NEWER_VERSION = 'AAAAAAAAB9F=';
  const newer = buildOrderDetail({
    customerName: 'Juan D. Cruz',
    contactNumber: '0917 555 0000',
    version: NEWER_VERSION,
    lastChangedBy: ORDER_STAFF_TWO,
    lastChangedAt: '2026-10-08T03:00:00Z',
  });

  it('shows the conflict banner above the first card on a 409, keeps the typed values and focuses Load Latest', async () => {
    let attempts = 0;
    useOrderHandlers({
      reply: () => {
        attempts += 1;
        return attempts === 1 ? orderProblem(409, 'edit.stale') : undefined;
      },
    });
    const { user } = await openEdit();
    const contact = screen.getByLabelText(/^Contact number/);
    await user.clear(contact);
    await user.type(contact, '0917 000 1111');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText('This was changed by someone else.')).toBeVisible();
    expect(within(banner).getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    const firstCard = screen.getByRole('heading', { level: 2, name: 'Customer details' });
    expect(banner.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText(/^Contact number/)).toHaveValue('0917 000 1111');
    expect(screen.queryByText('Order details saved')).toBeNull();
  });

  it('replaces the values and the version on Load Latest, focuses Customer name and says so', async () => {
    let current = order0148;
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: () => current,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? orderProblem(409, 'edit.stale') : undefined;
      },
    });
    const { user } = await openEdit();
    const contact = screen.getByLabelText(/^Contact number/);
    await user.clear(contact);
    await user.type(contact, '0917 000 1111');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    current = newer;
    await user.click(loadLatest);

    await waitFor(() => {
      expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan D. Cruz');
    });
    expect(screen.getByLabelText(/^Contact number/)).toHaveValue('0917 555 0000');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/^Customer name/)).toHaveFocus();
    expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(2);
    expect((backend.writes[1]?.body as { version: string }).version).toBe(NEWER_VERSION);
  });

  it('keeps the version it opened with when a focus refetch brings a newer one', async () => {
    let current = order0148;
    const backend = useOrderHandlers({ detail: () => current });
    const { user } = await openEdit();
    current = newer;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['order', order0148.id] });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<OrderDetailFixture>(['order', order0148.id])?.version).toBe(NEWER_VERSION);
    });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText('The order page');
    expect((backend.writes[0]?.body as { version: string }).version).toBe(ORDER_VERSION);
  });

  it('shows a skeleton in a Loading order region, then Order loaded. and focuses Customer name', async () => {
    useOrderHandlers({
      detail: async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return order0148;
      },
    });
    const { container } = renderEdit();

    expect(await screen.findByText('Loading order…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();

    expect(await screen.findByText('Order loaded.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/^Customer name/)).toHaveFocus();
    });
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('says the order was not found, with Back to Orders, when the order is missing or deleted', async () => {
    useOrderHandlers({ detail: () => orderProblem(404, 'orders.not-found') });
    renderEdit();

    expect(await screen.findByText('This order was not found or was deleted.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Orders' })).toHaveAttribute('href', '/admin/orders');
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();
  });

  it('says the order was not found when a save finds it deleted', async () => {
    useOrderHandlers({ reply: () => orderProblem(404, 'orders.not-found') });
    const { user } = await openEdit();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('This order was not found or was deleted.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Orders' })).toBeVisible();
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();
  });
});

describe('imported orders without a due date and locked orders (D-15, D-38, UIC-8)', () => {
  it('opens an imported order with Due date empty and the hint, and asks for a date without sending anything', async () => {
    const backend = useOrderHandlers({ detail: noDueDateOrder });
    const { user } = await openEdit({ detail: noDueDateOrder });

    expect(screen.getByLabelText(/^Due date/)).toHaveValue('');
    expect(screen.getByText('This order came in without a due date. Enter one to save.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Enter the due date.')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
    expect(screen.getByLabelText(/^Due date/)).toHaveFocus();
  });

  it('saves the due date once one is entered, and swaps the hint for the days away', async () => {
    const backend = useOrderHandlers({ detail: noDueDateOrder });
    const { user } = await openEdit({ detail: noDueDateOrder });

    setDate('Due date', '2026-08-20');

    expect(await screen.findByText('8 days from order date')).toBeVisible();
    expect(screen.queryByText('This order came in without a due date. Enter one to save.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('The order page');
    expect((backend.writes[0]?.body as { dueDate: string }).dueDate).toBe('2026-08-20');
  });

  it('shows no hint for an order that already has a due date', async () => {
    useOrderHandlers();
    await openEdit();

    expect(screen.queryByText('This order came in without a due date. Enter one to save.')).toBeNull();
  });

  it('shows the locked banner and Back to Order instead of the form for a completed order', async () => {
    useOrderHandlers({ detail: completedOrder });
    renderEdit({ detail: completedOrder });

    expect(await screen.findByText('This order is completed.')).toBeVisible();
    expect(screen.getByText('Reopen it to make changes.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Order' })).toHaveAttribute(
      'href',
      `/admin/orders/${completedOrder.id}`,
    );
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByText('Refunds can still be recorded on the Refunds tab.')).toBeNull();
  });

  it('adds the refunds line for a cancelled order', async () => {
    useOrderHandlers({ detail: cancelledOrderWithRefunds });
    renderEdit({ detail: cancelledOrderWithRefunds });

    expect(await screen.findByText('This order is cancelled.')).toBeVisible();
    expect(screen.getByText('Refunds can still be recorded on the Refunds tab.')).toBeVisible();
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();
  });

  it('shows the locked banner when a save finds the order locked meanwhile (422 orders.locked)', async () => {
    let current: OrderDetailFixture = order0148;
    useOrderHandlers({
      detail: () => current,
      reply: () => {
        current = completedOrder;
        return orderProblem(422, 'orders.locked');
      },
    });
    const { user } = await openEdit();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('This order is completed.')).toBeVisible();
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();
  });
});

function readyFile(file: File): PrepareResult {
  return {
    ok: true,
    file,
    name: file.name,
    type: 'image/jpeg',
    width: 3000,
    height: 2000,
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
  };
}

function pickedImage(name: string): File {
  return new File(['jpeg'], name, { type: 'image/jpeg' });
}

function galleryInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
  if (input === null) throw new Error('No gallery input');
  return input;
}

/** Picks files into the Images card and waits for their tiles. */
async function pickPhotos(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  names: readonly string[],
): Promise<void> {
  vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
  await screen.findAllByText(/0\/5/);
  await user.upload(galleryInput(container), names.map(pickedImage));
  const list = await screen.findByRole('list', { name: 'Order photos' });
  await waitFor(() => {
    expect(within(list).getAllByRole('listitem')).toHaveLength(names.length);
  });
}

describe('photos picked on the form (ORD-04, D-09, D-10, D-28)', () => {
  it('shows each picked photo as a draft tile named New order photo {n}', async () => {
    useOrderHandlers();
    const { user, container } = await openForm();

    await pickPhotos(user, container, ['one.jpg', 'two.jpg']);

    const list = screen.getByRole('list', { name: 'Order photos' });
    expect(within(list).getByText('New order photo 1')).toBeVisible();
    expect(within(list).getByText('New order photo 2')).toBeVisible();
  });

  it('creates the order first, then hands both drafts to the new order in their order, and lands on its page', async () => {
    const upload = vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(created);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const backend = useOrderHandlers({
      detail: created,
      reply: async () => {
        await gate;
        return HttpResponse.json(created, { status: 201 });
      },
    });
    const { user, router, container } = await openForm();
    await fillValidOrder(user);
    await pickPhotos(user, container, ['one.jpg', 'two.jpg']);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(upload).not.toHaveBeenCalled();
    release();

    await screen.findByText('The order page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${created.id}`);
    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
    });
    const [first, second] = upload.mock.calls;
    expect(first?.[0]).toBe(created.id);
    expect(first?.[2]).toBe('one.jpg');
    expect(second?.[0]).toBe(created.id);
    expect(second?.[2]).toBe('two.jpg');
  });

  it('keeps the drafts on the form with everything else when the create fails, and sends no upload', async () => {
    const upload = vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(created);
    useOrderHandlers({ reply: () => orderProblem(500) });
    const { user, container } = await openForm();
    await fillValidOrder(user);
    await pickPhotos(user, container, ['one.jpg', 'two.jpg']);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('Something went wrong')).toBeVisible();
    const list = screen.getByRole('list', { name: 'Order photos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Test Customer');
    expect(upload).not.toHaveBeenCalled();
  });

  it('sends no upload when the order is created with no drafts ([EDGE ORD-04 empty])', async () => {
    const upload = vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(created);
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(1);
    expect(upload).not.toHaveBeenCalled();
    expect(photoUploadQueue.snapshot(created.id).pending).toBe(0);
  });
});

describe('describing a draft on the form (D-12, D-30)', () => {
  it('opens the description window outside the form and does not save the order when it is saved', async () => {
    const backend = useOrderHandlers();
    const { user, container } = await openForm();
    await fillValidOrder(user);
    await pickPhotos(user, container, ['one.jpg', 'two.jpg']);

    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(dialog.closest('form')).toBeNull();
    await user.clear(within(dialog).getByLabelText('Photo description'));
    await user.type(within(dialog).getByLabelText('Photo description'), 'Back mockup');
    await user.click(within(dialog).getByRole('button', { name: 'Save Description' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Description' })).not.toBeInTheDocument();
    });
    expect(within(screen.getByRole('list', { name: 'Order photos' })).getByText('Back mockup')).toBeVisible();
    expect(backend.writes).toHaveLength(0);
  });

  it('sends each description with its photo to the new order: the typed text, and nothing for a default', async () => {
    const upload = vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(created);
    useOrderHandlers({ detail: created });
    const { user, container } = await openForm();
    await fillValidOrder(user);
    await pickPhotos(user, container, ['one.jpg', 'two.jpg']);
    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));
    const box = await screen.findByLabelText('Photo description');
    await user.clear(box);
    await user.type(box, 'Back mockup');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
    });
    expect(upload.mock.calls.map((call) => [call[2], call[3]])).toEqual([
      ['one.jpg', ''],
      ['two.jpg', 'Back mockup'],
    ]);
  });
});

describe('drafts and the Discard changes guard (ORD-15, D-09)', () => {
  it('asks "Discard changes?" when leaving with one draft and nothing else typed', async () => {
    useOrderHandlers();
    const { user, container, router } = await openForm();
    await pickPhotos(user, container, ['one.jpg']);

    await user.click(screen.getByRole('link', { name: 'Orders' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    expect(router.state.location.pathname).toBe('/admin/orders/new');
    expect(within(screen.getByRole('list', { name: 'Order photos' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('leaves without asking once the only draft is removed', async () => {
    useOrderHandlers();
    const { user, container } = await openForm();
    await pickPhotos(user, container, ['one.jpg']);
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));

    await user.click(screen.getByRole('link', { name: 'Orders' }));

    expect(await screen.findByText('The orders list')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads Unsaved changes in the save bar once a draft is picked', async () => {
    useOrderHandlers();
    const { user, container } = await openForm();
    expect(screen.queryByText('Unsaved changes')).toBeNull();

    await pickPhotos(user, container, ['one.jpg']);

    expect(screen.getByText('Unsaved changes')).toBeVisible();
  });
});

// R3 Turn into Order (INQ-06, D-20; plan 13-22): /admin/orders/new?fromRequest={id} fills the form once from the request.

const REQUEST_ID = quoteRequestId(5);
const FROM_REQUEST = `?fromRequest=${REQUEST_ID}`;

type OrderPrefill = components['schemas']['OrderPrefillResponse'];

function orderPrefill(overrides: Partial<OrderPrefill> = {}): OrderPrefill {
  return {
    quoteRequestId: REQUEST_ID,
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 555 0101',
    email: 'juan@example.test',
    notes: 'Twelve jerseys, numbers 1 to 12.',
    receivedOn: '2026-11-21',
    productTypeId: BASKETBALL_ID,
    ...overrides,
  };
}

/** Answers GET /quote-requests/{id}/order-prefill; returns the ids it was asked for. */
function usePrefill(
  answer: () => OrderPrefill | Response | Promise<OrderPrefill | Response> = () => orderPrefill(),
): string[] {
  const reads: string[] = [];
  server.use(
    http.get('*/api/v1/quote-requests/:id/order-prefill', async ({ params }) => {
      reads.push(String(params.id));
      const body = await answer();
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return reads;
}

/** Adds the one item the prefill leaves open, and a due date. */
async function finishPrefilledOrder(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  setDate('Due date', '2026-10-20');
  await user.type(screen.getByLabelText(/^Description/), 'Test jersey');
  await user.type(screen.getByLabelText(/^Qty/), '12');
  await user.type(screen.getByLabelText(/^Unit price/), '780');
}

/** The order body a prefilled form with `finishPrefilledOrder` sends, without the link. */
const PREFILLED_BODY = {
  customerName: 'Juan Dela Cruz',
  teamName: 'Brgy. San Roque Ballers',
  contactNumber: '0917 555 0101',
  email: 'juan@example.test',
  address: null,
  orderDate: '2026-10-08',
  dueDate: '2026-10-20',
  status: 'pending',
  notes: 'Twelve jerseys, numbers 1 to 12.',
  items: [
    { productTypeId: BASKETBALL_ID, description: 'Test jersey', sizeVariant: null, quantity: 12, unitPrice: 780 },
  ],
};

describe('Turn into Order: the prefill (INQ-06, D-20, UI-SPEC R3)', () => {
  it('shows the form skeleton while the request is read, then fills the form once from it', async () => {
    useOrderHandlers();
    const reads = usePrefill(async () => {
      await delay(120);
      return orderPrefill();
    });
    renderForm({ search: FROM_REQUEST });

    expect(await screen.findByText('Loading order form…')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Customer name/)).toBeNull();

    await screen.findByRole('heading', { level: 1, name: 'New Order' });
    await screen.findByRole('option', { name: 'Basketball Jersey' });
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByLabelText(/^Team \/ organization/)).toHaveValue('Brgy. San Roque Ballers');
    expect(screen.getByLabelText(/^Contact number/)).toHaveValue('0917 555 0101');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('juan@example.test');
    expect(screen.getByLabelText(/^Notes/)).toHaveValue('Twelve jerseys, numbers 1 to 12.');
    expect(screen.getByLabelText(/^Product type/)).toHaveValue(BASKETBALL_ID);
    expect(screen.getByLabelText(/^Description/)).toHaveValue('');
    expect(screen.getByLabelText(/^Qty/)).toHaveValue('');
    expect(screen.getByLabelText(/^Order date/)).toHaveValue('2026-10-08');
    expect(reads).toEqual([REQUEST_ID]);
  });

  it('leaves the product type empty when the request suggests none', async () => {
    useOrderHandlers();
    usePrefill(() => orderPrefill({ productTypeId: null, teamName: null, email: null, notes: null }));
    await openForm({ search: FROM_REQUEST });

    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByLabelText(/^Team \/ organization/)).toHaveValue('');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('');
    expect(screen.getByLabelText(/^Notes/)).toHaveValue('');
    expect(screen.getByLabelText(/^Product type/)).toHaveValue('');
  });

  it('says where the values came from, with View Request to the request', async () => {
    useOrderHandlers();
    usePrefill();
    await openForm({ search: FROM_REQUEST });

    expect(
      screen.getByText(
        'Filled in from the quote request from Juan Dela Cruz, received Nov 21, 2026. Add the items and prices, then save.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'View Request' })).toHaveAttribute(
      'href',
      `/admin/quote-requests/${REQUEST_ID}`,
    );
  });

  it('takes the prefilled values as the starting point, so leaving without typing does not ask', async () => {
    useOrderHandlers();
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });

    expect(screen.queryByText('Unsaved changes')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'View Request' }));

    expect(await screen.findByText('The quote request page')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before View Request leaves once something was typed', async () => {
    useOrderHandlers();
    usePrefill();
    const { user, router } = await openForm({ search: FROM_REQUEST });
    await user.type(screen.getByLabelText(/^Description/), 'Test jersey');

    await user.click(screen.getByRole('link', { name: 'View Request' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/orders/new');
  });

  it('saves the order with quoteRequestId, says the request is now Converted and reads the quote requests again', async () => {
    const backend = useOrderHandlers({ detail: created });
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.body).toEqual({ ...PREFILLED_BODY, quoteRequestId: REQUEST_ID });
    expect(await screen.findByText('Order saved')).toBeVisible();
    expect(screen.getByText('The quote request is now Converted.')).toBeVisible();
    // The prefix covers the request page, the inbox lists and the New count (13-17, D-14).
    expect(invalidatedRoots(invalidate)).toContainEqual(['quote-requests']);
  });

  it('replaces the prefilled form in the history after a linked save, so Back skips it (W10 WR-01)', async () => {
    useOrderHandlers({ detail: created });
    usePrefill();
    const { user, router } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(router.state.location.pathname).toBe(`/admin/orders/${created.id}`);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('still adds the new order to the history after a plain save', async () => {
    useOrderHandlers({ detail: created });
    const { user, router } = await openForm();
    await fillValidOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('says nothing about a quote request and reads none again after a plain save', async () => {
    const backend = useOrderHandlers({ detail: created });
    const { user } = await openForm();
    await fillValidOrder(user);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(await screen.findByText('Order saved')).toBeVisible();
    expect(backend.writes[0]?.body).not.toHaveProperty('quoteRequestId');
    expect(screen.queryByText('The quote request is now Converted.')).toBeNull();
    expect(invalidatedRoots(invalidate)).not.toContainEqual(['quote-requests']);
  });

  it('saves a prefilled email that ends in one dot, which the server and the quote form accept (OR-3)', async () => {
    const backend = useOrderHandlers({ detail: created });
    usePrefill(() => orderPrefill({ email: 'juan@example.com.' }));
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    await screen.findByText('The order page');
    expect(backend.writes[0]?.body).toEqual({
      ...PREFILLED_BODY,
      email: 'juan@example.com.',
      quoteRequestId: REQUEST_ID,
    });
  });

  it('has no axe violations with the prefill note', async () => {
    useOrderHandlers();
    usePrefill();
    const { container } = await openForm({ search: FROM_REQUEST });

    await expectNoAxeViolations(container);
  });
});

/** The 409 the server answers when the request already became an order (13-20), with or without the order. */
function alreadyConverted(order: { orderId: string; orderNumber: string } | null = EXISTING): Response {
  return HttpResponse.json(
    {
      title: 'This quote request was already turned into an order.',
      status: 409,
      code: 'quote-requests.already-converted',
      ...(order ?? {}),
    },
    { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const EXISTING = { orderId: orderId(160), orderNumber: 'ORD-2026-0160' };

describe('Turn into Order: a race or a missing request (D-23, UI-SPEC R3)', () => {
  it('keeps every value on a 409 already-converted and names the existing order above Save', async () => {
    const backend = useOrderHandlers({ reply: () => alreadyConverted() });
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    const box = await screen.findByRole('alert');
    expect(within(box).getByText('This request is already an order: ORD-2026-0160.')).toBeVisible();
    expect(within(box).getByRole('link', { name: 'Open Order ORD-2026-0160' })).toHaveAttribute(
      'href',
      `/admin/orders/${EXISTING.orderId}`,
    );
    expect(within(box).getByRole('button', { name: 'Save as a New Order Instead' })).toBeVisible();
    // The box sits above the save bar.
    const save = screen.getByRole('button', { name: 'Save Order' });
    expect(box.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(backend.writes).toHaveLength(1);
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Test jersey');
    expect(screen.getByLabelText(/^Unit price/)).toHaveValue('780.00');
    // Someone else converted it: the request page, the inbox and the New count read again.
    expect(invalidatedRoots(invalidate)).toContainEqual(['quote-requests']);
  });

  it('saves the same order with no link and a new Idempotency-Key on Save as a New Order Instead', async () => {
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: created,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? alreadyConverted() : undefined;
      },
    });
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    const box = await screen.findByRole('alert');

    await user.click(within(box).getByRole('button', { name: 'Save as a New Order Instead' }));

    await screen.findByText('The order page');
    expect(backend.writes).toHaveLength(2);
    expect(backend.writes[0]?.body).toEqual({ ...PREFILLED_BODY, quoteRequestId: REQUEST_ID });
    expect(backend.writes[1]?.body).toEqual(PREFILLED_BODY);
    expect(backend.writes[1]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(backend.writes[1]?.key).not.toBe(backend.writes[0]?.key);
    expect(await screen.findByText('Order saved')).toBeVisible();
    expect(screen.queryByText('The quote request is now Converted.')).toBeNull();
  });

  it('says the request is already an order with no link when the 409 names no order', async () => {
    useOrderHandlers({ reply: () => alreadyConverted(null) });
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    const box = await screen.findByRole('alert');
    expect(within(box).getByText('This request is already an order.')).toBeVisible();
    expect(within(box).queryByRole('link')).toBeNull();
    expect(within(box).getByRole('button', { name: 'Save as a New Order Instead' })).toBeVisible();
  });

  it('has no axe violations with the already-converted box shown', async () => {
    useOrderHandlers({ reply: () => alreadyConverted() });
    usePrefill();
    const { user, container } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await screen.findByRole('alert');

    await expectNoAxeViolations(container);
  });

  it('replaces the prefilled form in the history after Save as a New Order Instead too', async () => {
    let attempts = 0;
    useOrderHandlers({
      detail: created,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? alreadyConverted() : undefined;
      },
    });
    usePrefill();
    const { user, router } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    const box = await screen.findByRole('alert');

    await user.click(within(box).getByRole('button', { name: 'Save as a New Order Instead' }));

    await screen.findByText('The order page');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('names the order up front when this tab already read the request as Converted (W10 WR-01)', async () => {
    useOrderHandlers();
    usePrefill();
    queryClient.setQueryData(
      quoteRequestKey(REQUEST_ID),
      quoteRequestDetail(REQUEST_ID, { status: 'converted', ...EXISTING }),
    );
    await openForm({ search: FROM_REQUEST });

    const box = screen.getByRole('alert');
    expect(within(box).getByText('This request is already an order: ORD-2026-0160.')).toBeVisible();
    expect(within(box).getByRole('link', { name: 'Open Order ORD-2026-0160' })).toHaveAttribute(
      'href',
      `/admin/orders/${EXISTING.orderId}`,
    );
    expect(within(box).getByRole('button', { name: 'Save as a New Order Instead' })).toBeVisible();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
  });

  it('shows no box up front when the cached request is not Converted', async () => {
    useOrderHandlers();
    usePrefill();
    queryClient.setQueryData(quoteRequestKey(REQUEST_ID), quoteRequestDetail(REQUEST_ID, { status: 'quoted' }));
    await openForm({ search: FROM_REQUEST });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens a blank form with the info note when the request is not found', async () => {
    const backend = useOrderHandlers({ detail: created });
    usePrefill(() => orderProblem(404, 'quote-requests.not-found'));
    const { user } = await openForm({ search: FROM_REQUEST });

    expect(screen.getByText("Couldn't find that quote request. The form is blank.")).toBeVisible();
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('');
    expect(screen.queryByRole('link', { name: 'View Request' })).toBeNull();

    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await screen.findByText('The order page');
    expect(backend.writes[0]?.body).not.toHaveProperty('quoteRequestId');
  });

  it('opens a blank form with no message and drops a fromRequest that is not a request id with one replace', async () => {
    useOrderHandlers();
    const reads = usePrefill();
    const moves: string[] = [];
    let stop = (): void => undefined;
    const { router } = renderForm({
      search: '?fromRequest=abc',
      beforeRender: (watched) => {
        stop = watched.subscribe((state) => {
          if (!moves.includes(state.location.key)) moves.push(state.location.key);
        });
      },
    });

    await screen.findByRole('heading', { level: 1, name: 'New Order' });
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    stop();

    expect(router.state.location.pathname).toBe('/admin/orders/new');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(moves).toHaveLength(1);
    expect(reads).toEqual([]);
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('');
    expect(screen.queryByText("Couldn't find that quote request. The form is blank.")).toBeNull();
    expect(screen.queryByText(/^Filled in from the quote request/)).toBeNull();
  });

  it('shows the load error with Try Again when the prefill read fails, keeps the alert while it reads again, then fills the form', async () => {
    useOrderHandlers();
    let calls = 0;
    usePrefill(async () => {
      calls += 1;
      if (calls === 1) return orderProblem(500);
      await delay(80);
      return orderPrefill();
    });
    const { user } = { user: userEvent.setup(), ...renderForm({ search: FROM_REQUEST }) };

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't load the order form.")).toBeVisible();
    const retry = within(alert).getByRole('button', { name: 'Try Again' });
    await user.click(retry);

    expect(screen.getByRole('alert')).toBe(alert);
    expect(retry).toHaveFocus();
    await screen.findByRole('heading', { level: 1, name: 'New Order' });
    expect(screen.getByLabelText(/^Customer name/)).toHaveValue('Juan Dela Cruz');
    expect(calls).toBe(2);
  });

  it('keeps the values, drops the link and says so when a save finds the request deleted', async () => {
    let attempts = 0;
    const backend = useOrderHandlers({
      detail: created,
      reply: () => {
        attempts += 1;
        return attempts === 1 ? orderProblem(404, 'quote-requests.not-found') : undefined;
      },
    });
    usePrefill();
    const { user } = await openForm({ search: FROM_REQUEST });
    await finishPrefilledOrder(user);

    await user.click(screen.getByRole('button', { name: 'Save Order' }));

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByText("Couldn't find that quote request.")).toBeVisible();
    expect(within(banner).getByText('Press Save Order to save the order without it.')).toBeVisible();
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Test jersey');

    await user.click(screen.getByRole('button', { name: 'Save Order' }));
    await screen.findByText('The order page');
    expect(backend.writes[1]?.body).toEqual(PREFILLED_BODY);
    expect(backend.writes[1]?.key).not.toBe(backend.writes[0]?.key);
  });
});
