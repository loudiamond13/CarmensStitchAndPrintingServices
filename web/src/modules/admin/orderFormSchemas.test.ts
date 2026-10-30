import { describe, expect, it } from 'vitest';
import {
  blankOrderItem,
  createOrderSchema,
  orderDetailsSchema,
  orderItemSchema,
  toCreateOrderRequest,
  type CreateOrderFormInput,
  type OrderItemFormInput,
} from '@/modules/admin/orderFormSchemas';

// The New Order form schemas (OR-3; plan 08-13): every rule of OrderRules.cs, with the server's own message.

const PRODUCT_TYPE = '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6';

function item(overrides: Partial<OrderItemFormInput> = {}): OrderItemFormInput {
  return {
    productTypeId: PRODUCT_TYPE,
    description: 'Basketball jersey',
    sizeVariant: 'S-XL',
    quantity: '12',
    unitPrice: '780.00',
    ...overrides,
  };
}

function order(overrides: Partial<CreateOrderFormInput> = {}): CreateOrderFormInput {
  return {
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 000 0000',
    email: 'juan@example.test',
    address: '',
    orderDate: '2026-10-08',
    dueDate: '2026-10-20',
    status: 'pending',
    notes: '',
    items: [item()],
    ...overrides,
  };
}

/** The first message for a path, or undefined when the path is fine. */
function messageAt(input: CreateOrderFormInput, ...path: (string | number)[]): string | undefined {
  const result = createOrderSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path.join('.'))?.message;
}

describe('createOrderSchema: a good order', () => {
  it('accepts a complete order and trims the text', () => {
    const result = createOrderSchema.safeParse(order({ customerName: '  Juan Dela Cruz  ', notes: '  ' }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerName).toBe('Juan Dela Cruz');
      expect(result.data.notes).toBeNull();
      expect(result.data.teamName).toBe('Brgy. San Roque Ballers');
    }
  });

  it('opens with one blank item row and no product type chosen (D-49)', () => {
    expect(blankOrderItem()).toEqual({
      productTypeId: '',
      description: '',
      sizeVariant: '',
      quantity: '',
      unitPrice: '',
    });
  });
});

describe('customer details', () => {
  it.each([
    ['customerName', '', "Enter the customer's name."],
    ['customerName', '   ', "Enter the customer's name."],
    ['customerName', 'x'.repeat(101), 'Keep the customer name to 100 characters or fewer.'],
    ['teamName', 'x'.repeat(101), 'Keep the team name to 100 characters or fewer.'],
    ['contactNumber', '', 'Enter a contact number.'],
    ['contactNumber', 'abc', 'Use digits, spaces and + - ( ) only.'],
    ['contactNumber', '1'.repeat(31), 'Keep the contact number to 30 characters or fewer.'],
    ['email', 'x'.repeat(250) + '@a.test', 'Keep the email to 254 characters or fewer.'],
    ['email', 'not-an-email', 'Enter a valid email address.'],
    ['email', 'name@localhost', 'Enter a valid email address.'],
    ['email', 'a b@example.test', 'Enter a valid email address.'],
    ['address', 'x'.repeat(301), 'Keep the address to 300 characters or fewer.'],
    ['notes', 'x'.repeat(2001), 'Keep notes to 2,000 characters or fewer.'],
  ] as const)('says the server words for %s = %j', (field, value, message) => {
    expect(messageAt(order({ [field]: value }), field)).toBe(message);
  });

  it('accepts the optional fields empty, and a contact with + - ( ) and spaces', () => {
    const result = createOrderSchema.safeParse(
      order({ teamName: '', email: '', address: '', contactNumber: '+63 (917) 000-0000' }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamName).toBeNull();
      expect(result.data.email).toBeNull();
      expect(result.data.address).toBeNull();
    }
  });
});

describe('dates and status', () => {
  it.each([
    ['orderDate', '', 'Enter the order date.'],
    ['orderDate', '2026-02-30', 'Enter a real date.'],
    ['dueDate', '', 'Enter the due date.'],
    ['dueDate', 'soon', 'Enter a real date.'],
  ] as const)('says the server words for %s = %j', (field, value, message) => {
    expect(messageAt(order({ [field]: value }), field)).toBe(message);
  });

  it("rejects a due date before the order date, on the due date's field", () => {
    expect(messageAt(order({ orderDate: '2026-10-08', dueDate: '2026-10-07' }), 'dueDate')).toBe(
      "The due date can't be before the order date.",
    );
  });

  it('accepts the same day, and still says so when another field is wrong too', () => {
    expect(messageAt(order({ dueDate: '2026-10-08' }), 'dueDate')).toBeUndefined();
    expect(
      messageAt(order({ customerName: '', orderDate: '2026-10-08', dueDate: '2026-10-07' }), 'dueDate'),
    ).toBe("The due date can't be before the order date.");
  });

  it('does not compare the dates when the order date is not real', () => {
    expect(messageAt(order({ orderDate: 'x', dueDate: '2026-10-07' }), 'dueDate')).toBeUndefined();
  });

  it.each(['pending', 'mockup', 'production', 'ready', 'delivered'])('accepts the active status %s', (status) => {
    expect(createOrderSchema.safeParse(order({ status })).success).toBe(true);
  });

  it.each(['completed', 'cancelled', '', 'nope'])('refuses %j as a starting status', (status) => {
    expect(messageAt(order({ status }), 'status')).toBe('Choose a status.');
  });
});

describe('items', () => {
  it('needs at least one item and at most 100', () => {
    expect(messageAt(order({ items: [] }), 'items')).toBe('Add at least one item.');
    expect(createOrderSchema.safeParse(order({ items: Array.from({ length: 100 }, () => item()) })).success).toBe(true);
    expect(messageAt(order({ items: Array.from({ length: 101 }, () => item()) }), 'items')).toBe(
      'An order can have at most 100 items.',
    );
  });

  it.each([
    ['productTypeId', '', 'Choose a product type.'],
    ['description', '', 'Describe the item.'],
    ['description', ' '.repeat(3), 'Describe the item.'],
    ['description', 'x'.repeat(201), 'Keep the description to 200 characters or fewer.'],
    ['sizeVariant', 'x'.repeat(101), 'Keep the size or variant to 100 characters or fewer.'],
    ['quantity', '', 'Enter a quantity from 1 to 10,000.'],
    ['quantity', '0', 'Enter a quantity from 1 to 10,000.'],
    ['quantity', '10001', 'Enter a quantity from 1 to 10,000.'],
    ['quantity', '1.5', 'Enter a quantity from 1 to 10,000.'],
    ['quantity', '-3', 'Enter a quantity from 1 to 10,000.'],
    ['unitPrice', '', 'Enter a unit price.'],
    ['unitPrice', '.', 'Enter a unit price.'],
    ['unitPrice', '1000000.01', 'Enter a unit price from ₱0.00 to ₱1,000,000.00.'],
    ['unitPrice', '12.345', 'Use at most 2 decimal places.'],
  ] as const)('says the server words for item %s = %j', (field, value, message) => {
    const result = orderItemSchema.safeParse(item({ [field]: value }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
    }
  });

  it('puts an item error on its row, so a form can show it under that Qty', () => {
    expect(messageAt(order({ items: [item(), item({ quantity: '0' })] }), 'items', 1, 'quantity')).toBe(
      'Enter a quantity from 1 to 10,000.',
    );
  });

  it('accepts a unit price of 0.00 and of 1,000,000.00, and a quantity of 1 and of 10,000', () => {
    expect(orderItemSchema.safeParse(item({ unitPrice: '0.00', quantity: '1' })).success).toBe(true);
    expect(orderItemSchema.safeParse(item({ unitPrice: '1000000.00', quantity: '10000' })).success).toBe(true);
  });
});

describe('orderDetailsSchema', () => {
  it('holds the customer and date rules alone, for the edit form to reuse', () => {
    const { items: _items, status: _status, ...details } = order({ customerName: '' });

    const result = orderDetailsSchema.safeParse(details);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Enter the customer's name.");
    }
  });
});

describe('toCreateOrderRequest', () => {
  it('turns the checked text into the request and sends no attribution field', () => {
    const parsed = createOrderSchema.parse(order({ items: [item({ sizeVariant: '' })] }));

    const body = toCreateOrderRequest(parsed);

    expect(body).toEqual({
      customerName: 'Juan Dela Cruz',
      teamName: 'Brgy. San Roque Ballers',
      contactNumber: '0917 000 0000',
      email: 'juan@example.test',
      address: null,
      orderDate: '2026-10-08',
      dueDate: '2026-10-20',
      status: 'pending',
      notes: null,
      items: [
        { productTypeId: PRODUCT_TYPE, description: 'Basketball jersey', sizeVariant: null, quantity: 12, unitPrice: 780 },
      ],
    });
    expect(Object.keys(body)).not.toContain('createdById');
  });
});
