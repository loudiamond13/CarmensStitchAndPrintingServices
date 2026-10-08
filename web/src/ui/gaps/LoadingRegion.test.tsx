// WEB-06, A11Y-01 (02-UI-SPEC SPEC-GAP "Skeleton family + LoadingRegion"; Copywriting "Loading announcement"):
// aria-busy on the region while it loads, and one visually hidden polite status node for the announcements.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { LoadingRegion } from './LoadingRegion';

function region(busy: boolean, failed?: boolean) {
  return (
    <LoadingRegion busy={busy} things="orders" className="s-orders" {...(failed === undefined ? {} : { failed })}>
      <p>Orders go here</p>
    </LoadingRegion>
  );
}

describe('LoadingRegion', () => {
  it('sets aria-busy="true" and says "Loading orders…" while busy', async () => {
    const { container } = render(region(true));
    const busy = container.querySelector('.s-orders');
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy?.textContent).toBe('Orders go here');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading orders…');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveClass('csp-sr');
    await expectNoAxeViolations(container);
  });

  it('keeps the status node outside the busy region, so it is not held back', () => {
    const { container } = render(region(true));
    expect(container.querySelector('[aria-busy="true"] [role="status"]')).toBeNull();
  });

  it('removes aria-busy and says "Orders loaded." when the load ends', () => {
    const { container, rerender } = render(region(true));
    const status = screen.getByRole('status');
    rerender(region(false));
    expect(container.querySelector('.s-orders')).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Orders loaded.');
  });

  it('says nothing when it was never busy', async () => {
    const { container, rerender } = render(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('');
    rerender(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('');
    await expectNoAxeViolations(container);
  });

  it('says nothing after a failed load, because the ErrorState banner announces it', () => {
    const { rerender } = render(region(true));
    rerender(region(false, true));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('announces again on the next load', () => {
    const { rerender } = render(region(true));
    rerender(region(false));
    rerender(region(true));
    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…');
    rerender(region(false));
    expect(screen.getByRole('status')).toHaveTextContent('Orders loaded.');
  });

  it('has exactly one status node in every state', () => {
    const { container, rerender } = render(region(true));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    rerender(region(false));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
