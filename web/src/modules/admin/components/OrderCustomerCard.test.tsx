import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { OrderCustomerCard } from '@/modules/admin/components/OrderCustomerCard';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderDetail } from '@/test/orderFixtures';
import { quoteRequestId } from '@/test/quoteRequestFixtures';

// The order page's customer card and its "From quote request" row (UI-SPEC R3; D-21; plan 13-22).

const REQUEST_ID = quoteRequestId(5);

function renderCard(quoteRequest: string | null, readOnly = false) {
  return render(
    <MemoryRouter>
      <OrderCustomerCard order={buildOrderDetail({ quoteRequestId: quoteRequest })} readOnly={readOnly} />
    </MemoryRouter>,
  );
}

/** The terms of the card, in order. */
function terms(): string[] {
  const card = screen.getByRole('region', { name: 'Customer' });
  return within(card)
    .getAllByRole('term')
    .map((term) => term.textContent);
}

/** The value after a term. */
function valueOf(term: string): HTMLElement {
  const dt = screen.getByText(term, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`No value after ${term}`);
  return dd;
}

describe('OrderCustomerCard: the From quote request row (D-21)', () => {
  it('adds the row after Email, with View Request and its arrow to the request, on an order made from one', () => {
    renderCard(REQUEST_ID);

    expect(terms()).toEqual(['Name', 'Team', 'Contact', 'Email', 'From quote request', 'Address']);
    const link = within(valueOf('From quote request')).getByRole('link', { name: 'View Request' });
    expect(link).toHaveAttribute('href', `/admin/quote-requests/${REQUEST_ID}`);
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('has no row on an order made without a request', () => {
    renderCard(null);

    expect(terms()).toEqual(['Name', 'Team', 'Contact', 'Email', 'Address']);
    expect(screen.queryByRole('link', { name: 'View Request' })).toBeNull();
  });

  it('shows the row as text without the link in the deleted view', () => {
    renderCard(REQUEST_ID, true);

    expect(terms()).toContain('From quote request');
    expect(valueOf('From quote request')).toHaveTextContent('Yes');
    expect(within(valueOf('From quote request')).queryByRole('link')).toBeNull();
  });

  it('has no axe violations with the row', async () => {
    const { container } = renderCard(REQUEST_ID);

    await expectNoAxeViolations(container);
  });
});
