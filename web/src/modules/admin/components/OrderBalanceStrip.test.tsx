import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderBalanceStrip } from '@/modules/admin/components/OrderBalanceStrip';
import { expectNoAxeViolations } from '@/test/axe';
import { cancelledOrderWithRefunds, creditOrder, order0148, order0151 } from '@/test/orderFixtures';

// The slim balance card of the order page on phones (D-33; plan 08-12): Total and the balance state in one button that takes
// the person to the totals panel.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the slim balance card (D-33)', () => {
  it('shows Total and Balance due with the server figures', () => {
    render(<OrderBalanceStrip totals={order0148.totals} status={order0148.status} />);

    const strip = screen.getByRole('button', { name: 'Total ₱21,327.50, balance due ₱9,327.50. Show totals.' });
    expect(strip).toHaveTextContent('Total');
    expect(strip).toHaveTextContent('₱21,327.50');
    expect(strip).toHaveTextContent('Balance due');
    expect(strip).toHaveTextContent('₱9,327.50');
  });

  it('shows Fully Paid for a fully paid order', () => {
    render(<OrderBalanceStrip totals={order0151.totals} status={order0151.status} />);

    const strip = screen.getByRole('button', { name: 'Total ₱22,500.00, fully paid. Show totals.' });
    expect(strip).toHaveTextContent('Fully Paid');
  });

  it('shows the credit for an overpaid order', () => {
    render(<OrderBalanceStrip totals={creditOrder.totals} status={creditOrder.status} />);

    const strip = screen.getByRole('button', { name: 'Total ₱8,000.00, customer credit ₱1,000.00. Show totals.' });
    expect(strip).toHaveTextContent('Credit ₱1,000.00');
  });

  it('says Not collected for a Cancelled order with money unpaid (D-45)', () => {
    render(<OrderBalanceStrip totals={cancelledOrderWithRefunds.totals} status={cancelledOrderWithRefunds.status} />);

    const strip = screen.getByRole('button', { name: 'Total ₱8,500.00, not collected ₱5,500.00. Show totals.' });
    expect(strip).toHaveTextContent('Not collected');
  });

  it('scrolls to the totals panel and focuses its heading', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: false, media: query }) as unknown as MediaQueryList,
    );
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(
      <>
        <OrderBalanceStrip totals={order0148.totals} status={order0148.status} />
        <h2 id="order-totals" tabIndex={-1}>
          Totals
        </h2>
      </>,
    );

    await user.click(screen.getByRole('button'));

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Totals' }));
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(screen.getByRole('heading', { name: 'Totals' })).toHaveFocus();
  });

  it('scrolls at once under reduced motion', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: true, media: query }) as unknown as MediaQueryList,
    );
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(
      <>
        <OrderBalanceStrip totals={order0148.totals} status={order0148.status} />
        <h2 id="order-totals" tabIndex={-1}>
          Totals
        </h2>
      </>,
    );

    await user.click(screen.getByRole('button'));

    expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderBalanceStrip totals={order0148.totals} status={order0148.status} />);

    await expectNoAxeViolations(container);
  });
});
