import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderHeader } from '@/modules/admin/components/OrderHeader';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { buildOrderDetail, completedOrder, order0148, useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The header's Delete Order action (ORD-06, D-22, D-39, D-57; plan 08-22): a ghost-danger button on an active order that opens the
// confirm, and no button on a Completed or Cancelled order until it is reopened.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderHeader(order: OrderDetailResponse) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <OrderHeader order={order} backTo="/admin/orders" />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return user;
}

describe('the Delete Order button (D-22, D-39)', () => {
  it('shows Delete Order beside Edit Details on an active order', () => {
    renderHeader(order0148);

    expect(screen.getByRole('button', { name: 'Delete Order' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit Details' })).toBeVisible();
  });

  it('hides Delete Order on a Completed order until it is reopened', () => {
    renderHeader(completedOrder);

    expect(screen.queryByRole('button', { name: 'Delete Order' })).toBeNull();
  });

  it('hides Delete Order on a Cancelled order until it is reopened', () => {
    renderHeader(buildOrderDetail({ status: 'cancelled' }));

    expect(screen.queryByRole('button', { name: 'Delete Order' })).toBeNull();
  });

  it('opens the confirm with Cancel focused, and Cancel puts focus back on the button', async () => {
    const user = renderHeader(order0148);

    await user.click(screen.getByRole('button', { name: 'Delete Order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete ORD-2026-0148?' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(dialog).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete Order' })).toHaveFocus();
  });
});
