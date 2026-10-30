import { describe, expect, it } from 'vitest';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { buildOrderDetail, creditOrder, order0148 } from '@/test/orderFixtures';

// The toast of a saved order window (UI-SPEC Toasts, D-05): the title names the thing, the message names the server's balance.

describe('orderSavedMessage', () => {
  it('names the balance still owed', () => {
    expect(orderSavedMessage(order0148, 'item', 'added')).toEqual({
      title: 'Item added',
      message: 'Balance now ₱9,327.50.',
    });
  });

  it('says the order is fully paid when nothing is owed', () => {
    const paid = buildOrderDetail({ totals: { ...order0148.totals, balance: 0, fullyPaid: true } });

    expect(orderSavedMessage(paid, 'item', 'updated')).toEqual({
      title: 'Item updated',
      message: 'Order is now fully paid.',
    });
  });

  it('names the customer credit before anything else', () => {
    const message = orderSavedMessage(creditOrder, 'item', 'deleted');

    expect(message.title).toBe('Item deleted');
    expect(message.message).toMatch(/^Customer credit now ₱[\d,]+\.\d\d\.$/);
  });

  it('names the order expenses for an expense', () => {
    expect(orderSavedMessage(order0148, 'expense', 'added')).toEqual({
      title: 'Expense added',
      message: 'Order expenses now ₱6,065.00.',
    });
  });

  it('titles each thing', () => {
    expect(orderSavedMessage(order0148, 'payment', 'added').title).toBe('Payment added');
    expect(orderSavedMessage(order0148, 'discount', 'updated').title).toBe('Discount updated');
    expect(orderSavedMessage(order0148, 'refund', 'deleted').title).toBe('Refund deleted');
  });
});
