import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { PublicWebsiteCard } from '@/modules/admin/components/PublicWebsiteCard';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderDetail, order0148, publicWebsiteBlock, useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Public website card of the order page (UI-SPEC O1; D-16; plan 11-27): four rows and the Edit button for both roles.

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

function renderCard(order: OrderDetailResponse = order0148) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <PublicWebsiteCard order={order} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, ...view };
}

/** The value cell that sits beside a row label of the card. */
function valueOf(label: string): HTMLElement {
  const value = screen.getByText(label).nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`No value beside ${label}.`);
  }
  return value;
}

const NEVER_SHOWN_NO_TEAM = buildOrderDetail({ teamName: null });

const SHOWN = buildOrderDetail({
  publicWebsite: publicWebsiteBlock({
    customerConsent: true,
    consentRecordedAtUtc: '2026-10-06T02:00:00Z',
    consentRecordedByName: 'Liza Mercado',
    shownOnWebsite: true,
    shownSinceUtc: '2026-10-08T02:00:00Z',
    productLineId: '8c1f4a20-0000-4000-8000-000000000001',
    productLineTitle: 'Basketball Jerseys',
    hasPhoto: true,
  }),
});

describe('a never-shown order', () => {
  it('reads Customer OK No, On the website Not shown, and the empty value for Shown under and Name shown', () => {
    renderCard(NEVER_SHOWN_NO_TEAM);

    expect(screen.getByRole('region', { name: 'Public website' })).toBeVisible();
    expect(valueOf('Customer OK')).toHaveTextContent('No');
    expect(valueOf('On the website')).toHaveTextContent('Not shown');
    expect(valueOf('Shown under')).toHaveTextContent('Not set');
    expect(valueOf('Name shown')).toHaveTextContent('Not set');
  });

  it('names the team with the team name suffix when no name is set', () => {
    renderCard(order0148);

    expect(valueOf('Name shown')).toHaveTextContent('Brgy. San Roque Ballers (team name)');
  });
});

describe('a shown order', () => {
  it('reads who recorded the OK and when, the Shown badge since its date, the line and the team', () => {
    renderCard(SHOWN);

    expect(valueOf('Customer OK')).toHaveTextContent('Yes, recorded Oct 6, 2026 by Liza Mercado');
    expect(valueOf('On the website')).toHaveTextContent('Shown');
    expect(valueOf('On the website')).toHaveTextContent('since Oct 8, 2026');
    expect(valueOf('Shown under')).toHaveTextContent('Basketball Jerseys');
    expect(valueOf('Name shown')).toHaveTextContent('Brgy. San Roque Ballers (team name)');
  });

  it('shows the public name instead of the team when one is set', () => {
    const named = buildOrderDetail({
      publicWebsite: { ...SHOWN.publicWebsite, publicName: 'Sample Ballers' },
    });

    renderCard(named);

    expect(valueOf('Name shown')).toHaveTextContent('Sample Ballers');
    expect(valueOf('Name shown')).not.toHaveTextContent('(team name)');
  });
});

describe('a shown order with no photo', () => {
  it('says it shows once the order has a photo', () => {
    renderCard(buildOrderDetail({ publicWebsite: { ...SHOWN.publicWebsite, hasPhoto: false } }));

    expect(valueOf('On the website')).toHaveTextContent('Shown');
    expect(screen.getByText('It shows once the order has a photo.')).toBeVisible();
  });

  it('says nothing about a photo once the order has one', () => {
    renderCard(SHOWN);

    expect(screen.queryByText('It shows once the order has a photo.')).not.toBeInTheDocument();
  });

  it('says nothing about a photo on an order that is not shown', () => {
    renderCard(order0148);

    expect(screen.queryByText('It shows once the order has a photo.')).not.toBeInTheDocument();
  });
});

describe('a Cancelled order (D-38)', () => {
  const CANCELLED = buildOrderDetail({
    status: 'cancelled',
    publicWebsite: publicWebsiteBlock({ customerConsent: true, canShow: false }),
  });

  it('reads Not shown, explains why, and offers no Edit', () => {
    renderCard(CANCELLED);

    expect(valueOf('On the website')).toHaveTextContent('Not shown');
    expect(screen.getByText("Cancelled orders can't be shown on the website.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Edit public website settings' })).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderCard(CANCELLED);

    await expectNoAxeViolations(container);
  });
});

describe('a Completed order', () => {
  it('can still be edited: the order lock does not cover this card', () => {
    renderCard(buildOrderDetail({ status: 'completed' }));

    expect(screen.getByRole('button', { name: 'Edit public website settings' })).toBeVisible();
    expect(screen.queryByText("Cancelled orders can't be shown on the website.")).not.toBeInTheDocument();
  });
});

describe('the Edit button and accessibility', () => {
  it('opens the Public Website window from the Edit button named Edit public website settings', async () => {
    const { user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Edit public website settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Public Website' });
    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeVisible();
  });

  it('has no axe violations never shown or shown', async () => {
    const { container, rerender } = renderCard(NEVER_SHOWN_NO_TEAM);

    await expectNoAxeViolations(container);

    rerender(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <PublicWebsiteCard order={SHOWN} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await expectNoAxeViolations(container);
  });
});
