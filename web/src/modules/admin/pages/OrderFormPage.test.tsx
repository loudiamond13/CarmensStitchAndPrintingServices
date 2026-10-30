import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import OrderFormPage from '@/modules/admin/pages/OrderFormPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  buildOrderDetail,
  orderId,
  orderProblem,
  useOrderHandlers,
  type OrderBackend,
} from '@/test/orderFixtures';
import { BASKETBALL_ID } from '@/test/orderListFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

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
  queryClient.clear();
  clearSession();
});

interface RenderOptions {
  backend?: OrderBackend;
  /** The navigation state the form was opened with (the list sends `{ from }`). */
  state?: unknown;
}

/** Opens the form in a data router, with the Orders list and the new order's page as stand-ins to land on. */
function renderForm({ state }: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/admin/orders', element: <p>The orders list</p> },
      { path: '/admin/orders/new', element: <OrderFormPage /> },
      { path: '/admin/orders/:id', element: <p>The order page</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: [{ pathname: '/admin/orders/new', state }] },
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

  it('lists the five active statuses with Pending chosen', async () => {
    useOrderHandlers();
    await openForm();

    const status = screen.getByLabelText(/^Status/);
    expect(within(status).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Pending',
      'Mockup',
      'In Production',
      'Ready',
      'Delivered',
    ]);
    expect(status).toHaveValue('pending');
    expect(screen.getByText('Completed and Cancelled are set on the order page.')).toBeVisible();
  });

  it('says images are coming soon and has no uploader (D-27)', async () => {
    useOrderHandlers();
    const { container } = await openForm();

    expect(screen.getByText('Image uploads are coming soon.')).toBeVisible();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('offers a back link to the list the person came from, else to Orders (D-51)', async () => {
    useOrderHandlers();
    const { unmount } = await openForm({ state: { from: '/admin/orders?status=ready&view=table' } });
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders?status=ready&view=table');
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
