import { describe, expect, it } from 'vitest';
import {
  blankOrderItem,
  createOrderSchema,
  orderDetailsSchema,
  orderItemSchema,
  toCreateOrderRequest,
  toUpdateOrderDetailsRequest,
  updateOrderDetailsSchema,
  type CreateOrderFormInput,
  type OrderItemFormInput,
} from '@/modules/admin/orderFormSchemas';

// The New Order form schemas (OR-3; plan 08-13): every rule of OrderRules.cs, with the server's own message.

const PRODUCT_TYPE = '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6';
const LINE_ID = '8c1f4a20-0000-4000-8000-000000000001';

/** The public website values of a card nobody touched. */
const NO_PUBLIC = { customerConsent: false, showOnWebsite: false, productLineId: '', publicName: '' };

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
    ...NO_PUBLIC,
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
    expect(messageAt(order({ customerName: '', orderDate: '2026-10-08', dueDate: '2026-10-07' }), 'dueDate')).toBe(
      "The due date can't be before the order date.",
    );
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
    const { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes } = order({
      customerName: '',
    });
    const details = { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes };

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
        {
          productTypeId: PRODUCT_TYPE,
          description: 'Basketball jersey',
          sizeVariant: null,
          quantity: 12,
          unitPrice: 780,
        },
      ],
    });
    expect(Object.keys(body)).not.toContain('createdById');
  });

  it('passes a 2,000-character quote request message in Notes unchanged (UI-SPEC R3)', () => {
    // The quote form's message limit equals the Notes limit, so a prefilled message always fits.
    const message = `${'Line one of the message.\n'.repeat(79)}${'x'.repeat(25)}`;
    expect(message).toHaveLength(2000);

    const parsed = createOrderSchema.parse(order({ notes: message }));

    expect(parsed.notes).toBe(message);
    expect(toCreateOrderRequest(parsed).notes).toBe(message);
  });
});

describe('updateOrderDetailsSchema (UpdateOrderDetailsRequestValidator)', () => {
  const { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes } = order();
  const details = { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes, ...NO_PUBLIC };

  it('requires a due date, as the server does on an edit (D-38)', () => {
    const result = updateOrderDetailsSchema.safeParse({ ...details, dueDate: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(['Enter the due date.']);
    }
  });

  it('refuses a due date before the order date with the server words', () => {
    const result = updateOrderDetailsSchema.safeParse({ ...details, dueDate: '2026-10-07' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("The due date can't be before the order date.");
    }
  });
});

describe('toUpdateOrderDetailsRequest', () => {
  it('sends the checked details with the version the form opened with, and no attribution or status field', () => {
    const { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes } = order({
      teamName: '',
      email: '',
      notes: ' Rush ',
    });
    const parsed = updateOrderDetailsSchema.parse({
      customerName,
      teamName,
      contactNumber,
      email,
      address,
      orderDate,
      dueDate,
      notes,
      ...NO_PUBLIC,
    });

    const body = toUpdateOrderDetailsRequest(parsed, 'AAAAAAAAB9E=');

    expect(body).toEqual({
      customerName: 'Juan Dela Cruz',
      teamName: null,
      contactNumber: '0917 000 0000',
      email: null,
      address: null,
      orderDate: '2026-10-08',
      dueDate: '2026-10-20',
      notes: 'Rush',
      version: 'AAAAAAAAB9E=',
    });
    expect(Object.keys(body)).not.toContain('status');
    expect(Object.keys(body)).not.toContain('updatedById');
  });
});

// The Public website block of both order forms (UI-SPEC F1, F2; D-11, D-13; plan 11-35): the same words as the order window and the server.

const OK_AND_SHOW = { customerConsent: true, showOnWebsite: true };

describe('the public website block on the New Order form', () => {
  it('accepts a card nobody touched', () => {
    expect(createOrderSchema.safeParse(order()).success).toBe(true);
  });

  it('refuses Show without the customer OK, on Show', () => {
    expect(messageAt(order({ showOnWebsite: true }), 'showOnWebsite')).toBe('Tick Customer said OK to show first.');
  });

  it('refuses a name over 80 characters after trimming, and accepts exactly 80', () => {
    expect(messageAt(order({ publicName: 'x'.repeat(81) }), 'publicName')).toBe(
      'Keep the name to 80 characters or fewer.',
    );
    expect(messageAt(order({ publicName: `  ${'x'.repeat(80)}  ` }), 'publicName')).toBeUndefined();
  });

  it('needs a name to show an order that has no team, and takes the team typed on the form', () => {
    const noTeam = order({ ...OK_AND_SHOW, teamName: '  ', productLineId: LINE_ID });

    expect(messageAt(noTeam, 'publicName')).toBe('This order has no team name. Enter the name to show.');
    expect(messageAt({ ...noTeam, publicName: 'Riders' }, 'publicName')).toBeUndefined();
    expect(messageAt({ ...noTeam, teamName: 'Test Hawks' }, 'publicName')).toBeUndefined();
  });

  it('does not need a name for an order with no team while it is not shown', () => {
    expect(messageAt(order({ teamName: '', customerConsent: true }), 'publicName')).toBeUndefined();
  });

  it('leaves the line to the server on a new order: the items are not known to the browser', () => {
    expect(messageAt(order({ ...OK_AND_SHOW }), 'productLineId')).toBeUndefined();
  });

  it('checks the block even when another field is wrong too', () => {
    expect(messageAt(order({ customerName: '', showOnWebsite: true }), 'showOnWebsite')).toBe(
      'Tick Customer said OK to show first.',
    );
  });
});

describe('the public website block on the Edit Order form', () => {
  const { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes } = order();
  const details = { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes, ...NO_PUBLIC };

  function messageFor(overrides: Partial<typeof details>, path: string): string | undefined {
    const result = updateOrderDetailsSchema.safeParse({ ...details, ...overrides });
    return result.success ? undefined : result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
  }

  it('refuses Show without the customer OK, a long name and a missing line, in the window words', () => {
    expect(messageFor({ showOnWebsite: true }, 'showOnWebsite')).toBe('Tick Customer said OK to show first.');
    expect(messageFor({ publicName: 'x'.repeat(81) }, 'publicName')).toBe('Keep the name to 80 characters or fewer.');
    expect(messageFor({ ...OK_AND_SHOW }, 'productLineId')).toBe('Choose the product line to show this order under.');
    expect(messageFor({ ...OK_AND_SHOW, productLineId: LINE_ID }, 'productLineId')).toBeUndefined();
  });

  it('needs a name for an order with no team', () => {
    expect(messageFor({ ...OK_AND_SHOW, productLineId: LINE_ID, teamName: '' }, 'publicName')).toBe(
      'This order has no team name. Enter the name to show.',
    );
  });
});

describe('the public website block in the requests', () => {
  it('sends no block on a create when the card was left as it was', () => {
    expect(toCreateOrderRequest(createOrderSchema.parse(order()))).not.toHaveProperty('publicWebsite');
  });

  it('sends the OK and Show with no line and no name as nulls', () => {
    const body = toCreateOrderRequest(createOrderSchema.parse(order({ ...OK_AND_SHOW })));

    expect(body.publicWebsite).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: null,
      publicName: null,
    });
  });

  it('sends the line and the trimmed name when they are set, and the OK alone when Show is off', () => {
    const body = toCreateOrderRequest(
      createOrderSchema.parse(order({ customerConsent: true, productLineId: LINE_ID, publicName: '  Riders  ' })),
    );

    expect(body.publicWebsite).toEqual({
      customerConsent: true,
      showOnWebsite: false,
      productLineId: LINE_ID,
      publicName: 'Riders',
    });
  });

  describe('on an edit', () => {
    const { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes } = order();
    const details = { customerName, teamName, contactNumber, email, address, orderDate, dueDate, notes };
    const opened = { customerConsent: true, showOnWebsite: true, productLineId: LINE_ID, publicName: 'Riders' };

    it('sends no block while the card still holds what the order had', () => {
      const parsed = updateOrderDetailsSchema.parse({ ...details, ...opened });

      expect(toUpdateOrderDetailsRequest(parsed, 'AAAAAAAAB9E=', opened)).not.toHaveProperty('publicWebsite');
    });

    it('sends the whole block once one value changed, and an all-off block when the OK was taken back', () => {
      const renamed = updateOrderDetailsSchema.parse({ ...details, ...opened, publicName: 'Riders MC' });
      const off = updateOrderDetailsSchema.parse({ ...details, ...NO_PUBLIC, productLineId: LINE_ID });

      expect(toUpdateOrderDetailsRequest(renamed, 'AAAAAAAAB9E=', opened).publicWebsite).toEqual({
        customerConsent: true,
        showOnWebsite: true,
        productLineId: LINE_ID,
        publicName: 'Riders MC',
      });
      expect(toUpdateOrderDetailsRequest(off, 'AAAAAAAAB9E=', opened).publicWebsite).toEqual({
        customerConsent: false,
        showOnWebsite: false,
        productLineId: LINE_ID,
        publicName: null,
      });
    });
  });
});
