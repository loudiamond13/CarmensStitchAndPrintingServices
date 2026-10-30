import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderItemsEditor } from '@/modules/admin/components/OrderItemsEditor';
import {
  blankOrderItem,
  createOrderSchema,
  type CreateOrderFormInput,
  type CreateOrderFormValues,
  type OrderItemFormInput,
} from '@/modules/admin/orderFormSchemas';
import { useOrderHandlers } from '@/test/orderFixtures';

// The item grid of the New Order form (UI-SPEC F1 card 4; plan 08-13): one blank row to start, Add and Remove with their focus
// rules, the 100 row limit, live line totals and the footer.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
});

function row(overrides: Partial<OrderItemFormInput> = {}): OrderItemFormInput {
  return { ...blankOrderItem(), ...overrides };
}

function Harness({ items }: { items: OrderItemFormInput[] }) {
  const form = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onBlur',
    defaultValues: {
      customerName: '',
      teamName: '',
      contactNumber: '',
      email: '',
      address: '',
      orderDate: '2026-10-08',
      dueDate: '',
      status: 'pending',
      notes: '',
      items,
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(() => undefined)(event);
      }}
    >
      <OrderItemsEditor control={form.control} rootError={form.formState.errors.items?.root?.message} />
      <button type="submit">Check items</button>
    </form>
  );
}

async function renderEditor(items: OrderItemFormInput[] = [row()]) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Harness items={items} />
    </QueryClientProvider>,
  );
  await screen.findAllByRole('option', { name: 'Basketball Jersey' }, { timeout: 15_000 });
  return { ...view, user: userEvent.setup() };
}

/** The Product type select of item `n` (1-based). */
function typeOf(n: number): HTMLElement {
  return within(screen.getByRole('group', { name: `Item ${String(n)}` })).getByLabelText(/^Product type/);
}

describe('the opening grid (D-49)', () => {
  it('opens with one blank row and no product type chosen', async () => {
    await renderEditor();

    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(1);
    expect(typeOf(1)).toHaveValue('');
    expect(within(typeOf(1)).getByRole('option', { name: 'Choose a product type' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Description/)).toHaveAttribute('placeholder', 'e.g. Jersey top, sublimated');
    expect(screen.getByLabelText(/^Size \/ variant/)).toHaveAttribute('placeholder', 'e.g. S-XL');
    expect(screen.getByLabelText(/^Qty/)).toHaveAttribute('inputmode', 'numeric');
  });

  it('names the card and its Add Item button', async () => {
    await renderEditor();

    expect(screen.getByRole('heading', { level: 2, name: 'Order items' })).toBeVisible();
    expect(screen.getByText('Add as many lines as you need. Sizes and variants can share a line.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeVisible();
  });

  it('marks each row for the 40px (44px on phones) controls', async () => {
    const { container } = await renderEditor();

    const rowElement = container.querySelector('[data-ui="s-item"]');
    expect(rowElement).not.toBeNull();
    expect(rowElement?.className).toContain('pg-phone:[&_input]:h-11');
    expect(rowElement?.className).toContain('pg-phone:[&_select]:h-11');
  });
});

describe('Add Item and Remove (focus rules)', () => {
  it('adds a row and moves focus to its Product type', async () => {
    const { user } = await renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add Item' }));

    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(2);
    expect(typeOf(2)).toHaveFocus();
    expect(typeOf(2)).toHaveValue('');
  });

  it('removes a row and focuses the next row Product type', async () => {
    const { user } = await renderEditor([row({ description: 'one' }), row({ description: 'two' }), row({ description: 'three' })]);

    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));

    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(2);
    expect(typeOf(1)).toHaveFocus();
    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText(/^Description/)).toHaveValue('two');
  });

  it('focuses the previous row Product type when the last row is removed', async () => {
    const { user } = await renderEditor([row({ description: 'one' }), row({ description: 'two' })]);

    await user.click(screen.getByRole('button', { name: 'Remove item 2' }));

    expect(typeOf(1)).toHaveFocus();
  });

  it('shows the empty line and focuses Add Item when the only row is removed (UIC-10)', async () => {
    const { user } = await renderEditor();

    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));

    expect(screen.getByText('No items yet. Add at least one to save the order.')).toBeVisible();
    expect(screen.queryByRole('group', { name: /^Item \d+$/ })).toBeNull();
    const adds = screen.getAllByRole('button', { name: 'Add Item' });
    expect(adds).toHaveLength(2);
    expect(adds.some((button) => button === document.activeElement)).toBe(true);
    const [firstAdd] = adds;
    if (firstAdd === undefined) throw new Error('No Add Item button');
    await user.click(firstAdd);
    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(1);
  });

  it('shows the list message when a check ran with no items', async () => {
    const { user } = await renderEditor();
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));

    await user.click(screen.getByRole('button', { name: 'Check items' }));

    expect(await screen.findByText('Add at least one item.')).toBeVisible();
  });
});

describe('the 100 item limit', () => {
  it('makes Add Item aria-disabled at 100 rows and says why, 100 rows', async () => {
    const { user } = await renderEditor(Array.from({ length: 99 }, () => row()));

    await user.click(screen.getByRole('button', { name: 'Add Item' }));

    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(100);
    const add = screen.getByRole('button', { name: 'Add Item' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('An order can have at most 100 items.')).toBeVisible();
    await user.click(add);
    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(100);
  }, 30_000);

  it('allows Add Item again after a row is removed from 100', async () => {
    const { user } = await renderEditor(Array.from({ length: 100 }, () => row()));
    expect(screen.getByRole('button', { name: 'Add Item' })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: 'Remove item 100' }));

    expect(screen.getByRole('button', { name: 'Add Item' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('An order can have at most 100 items.')).toBeNull();
  }, 30_000);
});

describe('previews', () => {
  it('updates each line total from the quantity and unit price', async () => {
    const { user } = await renderEditor([row({ quantity: '12', unitPrice: '780.00' })]);

    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByText('₱9,360.00')).toBeVisible();
    const quantity = screen.getByLabelText(/^Qty/);
    await user.clear(quantity);
    await user.type(quantity, '3');

    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByText('₱2,340.00')).toBeVisible();
  });

  it('reads "3 pcs across 1 line item" and "ITEMS SUBTOTAL" in the footer', async () => {
    await renderEditor([row({ quantity: '3', unitPrice: '100' })]);

    expect(screen.getByText('3 pcs across 1 line item')).toBeVisible();
    expect(screen.getByText('Items subtotal')).toBeVisible();
    expect(screen.getByText('Items subtotal').nextElementSibling).toHaveTextContent('₱300.00');
  });

  it('says line items when there are several', async () => {
    await renderEditor([row({ quantity: '2', unitPrice: '10' }), row({ quantity: '5', unitPrice: '20.50' })]);

    expect(screen.getByText('7 pcs across 2 line items')).toBeVisible();
    expect(screen.getByText('Items subtotal').nextElementSibling).toHaveTextContent('₱122.50');
  });
});

describe('the checks under each field', () => {
  it('says a quantity of 0 is out of range', async () => {
    const { user } = await renderEditor([row({ quantity: '0' })]);

    await user.click(screen.getByRole('button', { name: 'Check items' }));

    expect(await screen.findByText('Enter a quantity from 1 to 10,000.')).toBeVisible();
  });

  it('says a 201 character description is too long', async () => {
    const { user } = await renderEditor([row()]);
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'x'.repeat(201) } });

    await user.click(screen.getByRole('button', { name: 'Check items' }));

    expect(await screen.findByText('Keep the description to 200 characters or fewer.')).toBeVisible();
  });
});
