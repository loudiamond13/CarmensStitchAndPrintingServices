import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { OrderLockedBanner } from './OrderLockedBanner';

// OrderLockedBanner (D-15, UI-SPEC O1 "Locked order"): the neutral banner a Completed or Cancelled order shows.

describe('OrderLockedBanner', () => {
  it('says a completed order is completed and how to change it', async () => {
    const { container } = render(<OrderLockedBanner status="completed" />);

    expect(screen.getByText('This order is completed.')).toBeVisible();
    expect(screen.getByText('Reopen it to make changes.')).toBeVisible();
    expect(screen.queryByText('Refunds can still be recorded on the Refunds tab.')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('adds the refunds line to a cancelled order', async () => {
    const { container } = render(<OrderLockedBanner status="cancelled" />);

    expect(screen.getByText('This order is cancelled.')).toBeVisible();
    expect(screen.getByText('Reopen it to make changes.')).toBeVisible();
    expect(screen.getByText('Refunds can still be recorded on the Refunds tab.')).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('draws a lock icon that is hidden from assistive technology', () => {
    const { container } = render(<OrderLockedBanner status="completed" />);

    const icon = container.querySelector('svg.lucide-lock');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '20');
  });

  it('renders its children as an action after the text', async () => {
    const { container } = render(
      <OrderLockedBanner status="completed">
        <button type="button">Back to Order</button>
      </OrderLockedBanner>,
    );

    const text = screen.getByText('This order is completed.');
    const action = screen.getByRole('button', { name: 'Back to Order' });
    expect(text.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('carries no inline style (strict CSP)', () => {
    const { container } = render(<OrderLockedBanner status="cancelled">x</OrderLockedBanner>);

    expect(container.querySelector('[style]')).toBeNull();
  });
});
