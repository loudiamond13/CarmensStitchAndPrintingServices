import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { orderSavedMessage, useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { buildOrderDetail, creditOrder, order0148, orderProblem, useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

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

// How a window shows a failed save (UI-SPEC O2 Outcomes; plan 08-14): 409 keeps the typed values behind a banner, 404 says the
// record is gone, 422 shows the server's sentence, 400 goes under the fields.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function problem(status: number, code?: string, detail?: string, errors: Record<string, string[]> = {}): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'x',
      status,
      detail,
      instance: undefined,
      traceId: undefined,
      code,
      errors,
    },
  });
}

interface SaveOptions {
  rejection?: unknown;
  onFieldErrors?: (errors: Readonly<Record<string, readonly string[]>>) => boolean;
  onLatest?: (order: unknown) => boolean;
  verb?: 'added' | 'updated';
}

function renderSave({ rejection, onFieldErrors, onLatest, verb = 'updated' }: SaveOptions = {}) {
  const send = vi.fn(() => (rejection === undefined ? Promise.resolve(order0148) : Promise.reject(rejection as Error)));
  const onSaved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () =>
      useOrderChildSave<{ version: string }>({
        orderId: order0148.id,
        thing: 'item',
        verb,
        send,
        onSaved,
        onFieldErrors,
        onLatest,
      }),
    { wrapper },
  );
  return { ...view, send, onSaved };
}

async function save(view: ReturnType<typeof renderSave>, version = 'v1'): Promise<void> {
  await act(async () => {
    view.result.current.submit({ version });
    await Promise.resolve();
  });
}

describe('a stale save (409 edit.stale)', () => {
  it('shows the conflict banner, keeps the window open and counts each refusal', async () => {
    const view = renderSave({ rejection: problem(409, 'edit.stale') });

    await save(view);
    await waitFor(() => {
      expect(view.result.current.banner).toEqual({ kind: 'conflict', count: 1 });
    });
    expect(view.result.current.state).toBe('conflict');
    expect(view.result.current.saveBlocked).toBe(false);
    expect(view.onSaved).not.toHaveBeenCalled();

    await save(view, 'v2');
    await waitFor(() => {
      expect(view.result.current.banner).toEqual({ kind: 'conflict', count: 2 });
    });
  });
});

describe('a record that is gone (404)', () => {
  it('says the item was removed and blocks Save for orders.item-not-found', async () => {
    const view = renderSave({ rejection: problem(404, 'orders.item-not-found') });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({
        kind: 'removed',
        title: 'This item was removed.',
        body: 'Close this and check the order.',
      });
    });
    expect(view.result.current.state).toBe('removed');
    expect(view.result.current.saveBlocked).toBe(true);
  });

  it('says the order was removed for orders.not-found', async () => {
    const view = renderSave({ rejection: problem(404, 'orders.not-found') });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({
        kind: 'removed',
        title: 'This order was removed.',
        body: 'Close this and check the order.',
      });
    });
    expect(view.result.current.saveBlocked).toBe(true);
  });
});

describe('a refusal (422)', () => {
  it('shows the server sentence, blocks Save and reads the order again for orders.locked', async () => {
    queryClient.setQueryData(orderKey(order0148.id), order0148);
    const view = renderSave({
      rejection: problem(422, 'orders.locked', 'This order is completed. Reopen it to make changes.'),
    });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({
        kind: 'message',
        text: 'This order is completed. Reopen it to make changes.',
      });
    });
    expect(view.result.current.state).toBe('locked');
    expect(view.result.current.saveBlocked).toBe(true);
    expect(queryClient.getQueryState(orderKey(order0148.id))?.isInvalidated).toBe(true);
  });

  it('shows the server sentence for any other refusal and leaves Save usable', async () => {
    const view = renderSave({
      rejection: problem(
        422,
        'orders.discount-above-subtotal',
        'The discounts would be more than the items total. Lower or remove a discount first.',
      ),
    });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({
        kind: 'message',
        text: 'The discounts would be more than the items total. Lower or remove a discount first.',
      });
    });
    expect(view.result.current.state).toBe('refused');
    expect(view.result.current.saveBlocked).toBe(false);
  });
});

describe('field errors (400)', () => {
  it('hands the server messages to the window and shows no banner when a field took them', async () => {
    const onFieldErrors = vi.fn(() => true);
    const view = renderSave({
      rejection: problem(400, undefined, undefined, { quantity: ['Enter a quantity from 1 to 10,000.'] }),
      onFieldErrors,
    });

    await save(view);

    await waitFor(() => {
      expect(onFieldErrors).toHaveBeenCalledWith({ quantity: ['Enter a quantity from 1 to 10,000.'] });
    });
    expect(view.result.current.banner).toBeNull();
    expect(view.result.current.fieldErrors).toEqual({ quantity: ['Enter a quantity from 1 to 10,000.'] });
  });

  it('shows the first server message in the window when no field matches', async () => {
    const view = renderSave({
      rejection: problem(400, undefined, undefined, { version: ['Reload the form and try again.'] }),
      onFieldErrors: () => false,
    });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({ kind: 'message', text: 'Reload the form and try again.' });
    });
  });
});

describe('any other failure', () => {
  it('shows the plain line from the problem mapper, never server text', async () => {
    const view = renderSave({ rejection: problem(500, undefined, 'Something went wrong. Reference: abc') });

    await save(view);

    await waitFor(() => {
      expect(view.result.current.banner).toEqual({
        kind: 'message',
        text: 'Something went wrong. Please try again.',
      });
    });
    expect(view.result.current.saveBlocked).toBe(false);
  });
});

describe('Load Latest', () => {
  it('reads the order, sets it on the page, hands it to the window and clears the banner', async () => {
    const latest = buildOrderDetail({ version: 'AAAAAAAAB9F=' });
    useOrderHandlers({ detail: latest });
    const onLatest = vi.fn(() => true);
    const view = renderSave({ rejection: problem(409, 'edit.stale'), onLatest });
    await save(view);
    await waitFor(() => {
      expect(view.result.current.banner?.kind).toBe('conflict');
    });

    let loaded = false;
    await act(async () => {
      loaded = await view.result.current.loadLatest();
    });

    expect(loaded).toBe(true);
    expect(onLatest).toHaveBeenCalledWith(latest);
    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(latest);
    expect(view.result.current.banner).toBeNull();
    expect(view.result.current.status).toBe('Latest version loaded. Make your changes again.');
  });

  it('says the typed values are kept when adding', async () => {
    useOrderHandlers({ detail: buildOrderDetail({ version: 'AAAAAAAAB9F=' }) });
    const view = renderSave({ rejection: problem(409, 'edit.stale'), verb: 'added' });

    await act(async () => {
      await view.result.current.loadLatest();
    });

    expect(view.result.current.status).toBe('Latest version loaded. What you typed is kept.');
  });

  it('shows the removed banner and returns false when the window record is not in the latest order', async () => {
    useOrderHandlers({ detail: order0148 });
    const view = renderSave({ onLatest: () => false });

    let loaded = true;
    await act(async () => {
      loaded = await view.result.current.loadLatest();
    });

    expect(loaded).toBe(false);
    expect(view.result.current.banner).toEqual({
      kind: 'removed',
      title: 'This item was removed.',
      body: 'Close this and check the order.',
    });
    expect(view.result.current.saveBlocked).toBe(true);
  });

  it('says the order was removed when the order itself is gone', async () => {
    useOrderHandlers({ detail: () => orderProblem(404, 'orders.not-found') });
    const view = renderSave();

    let loaded = true;
    await act(async () => {
      loaded = await view.result.current.loadLatest();
    });

    expect(loaded).toBe(false);
    expect(view.result.current.banner).toEqual({
      kind: 'removed',
      title: 'This order was removed.',
      body: 'Close this and check the order.',
    });
  });
});
