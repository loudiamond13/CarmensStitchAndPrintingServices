import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { PublicWebsiteModal } from '@/modules/admin/components/PublicWebsiteModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_VERSION,
  PRODUCT_LINE_OPTIONS,
  publicWebsiteBlock,
  useOrderHandlers,
  type OrderBackend,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Public Website window (UI-SPEC O1; D-09, D-11, D-13, D-16; plan 11-27): the OK, Show, the line, the name; Show waits for the OK.

const BASKETBALL = '8c1f4a20-0000-4000-8000-000000000001';
const AUTO_LINE_ORDER = buildOrderDetail({
  publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL, productLineId: BASKETBALL }),
});

let queryClient: QueryClient;
let backend: OrderBackend;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  backend = useOrderHandlers({ detail: SHOWN_ANSWER });
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

/** The order the server answers after the OK and Show were saved. */
const SHOWN_ANSWER = buildOrderDetail({
  publicWebsite: publicWebsiteBlock({
    customerConsent: true,
    consentRecordedAtUtc: '2026-10-08T03:00:00Z',
    consentRecordedByName: 'Liza Mercado',
    shownOnWebsite: true,
    shownSinceUtc: '2026-10-08T03:00:00Z',
    autoProductLineId: BASKETBALL,
    productLineId: BASKETBALL,
    productLineTitle: 'Basketball Jerseys',
    hasPhoto: true,
  }),
  version: 'AAAAAAAAB9F=',
});

/** A trigger button that opens the window, so the focus return can be seen. */
function Harness({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetailResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Edit public website settings
      </button>
      <PublicWebsiteModal
        order={order}
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        onSaved={onSaved}
      />
    </>
  );
}

function setup(order: OrderDetailResponse) {
  queryClient.setQueryData(orderKey(order.id), order);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Harness order={order} onClose={onClose} onSaved={onSaved} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, onClose, onSaved };
}

async function openWindow(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Edit public website settings' }));
  const dialog = await screen.findByRole('dialog', { name: 'Public Website' });
  // The line options arrive after the window opens.
  await within(dialog).findByRole('option', { name: PRODUCT_LINE_OPTIONS[0]?.title ?? '' });
  return dialog;
}

describe('the fields', () => {
  it('describes the window with the order number and the team', async () => {
    const { user } = setup(AUTO_LINE_ORDER);

    const dialog = await openWindow(user);

    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeVisible();
  });

  it('keeps Show on the website aria-disabled, with its hint as its description, until the OK is ticked', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);
    const ok = within(dialog).getByRole('checkbox', { name: 'Customer said OK to show' });
    const show = within(dialog).getByRole('checkbox', { name: 'Show on the website' });

    expect(ok).not.toBeChecked();
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription('Tick Customer said OK to show first.');

    await user.click(show);
    expect(show).not.toBeChecked();

    await user.click(ok);
    expect(show).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(show);
    expect(show).toBeChecked();
  });

  it('presets Show under to the line the server worked out from the items', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    expect(within(dialog).getByRole('combobox', { name: 'Show under' })).toHaveValue(BASKETBALL);
  });

  it('has no axe violations', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await expectNoAxeViolations(dialog);
  });
});

describe('saving', () => {
  it('sends the OK, Show, the preset line, no name and the order version; closes, returns focus to Edit and says the order is shown', async () => {
    const { user, onClose, onSaved } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(within(dialog).getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show on the website' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.method).toBe('PUT');
    expect(backend.writes[0]?.path).toBe(`/orders/${order0148.id}/public`);
    expect(backend.writes[0]?.body).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: BASKETBALL,
      publicName: null,
      version: ORDER_VERSION,
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Public Website' })).not.toBeInTheDocument();
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit public website settings' })).toHaveFocus();
    expect(await screen.findByText('Order shown on the website')).toBeVisible();
    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(SHOWN_ANSWER);
  });
});
