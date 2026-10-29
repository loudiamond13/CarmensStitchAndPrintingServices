import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { DueFlag } from './DueFlag';

// DueFlag (ORD-11, D-36 to D-38, UIC-51): the due date and its flag, from the server's business today.

describe('DueFlag', () => {
  it('shows Overdue by 3 days with the alert icon and the danger color for ORD-2026-0153', async () => {
    const { container } = render(<DueFlag today="2026-10-29" dueDate="2026-10-26" status="production" />);

    expect(screen.getByText('Due Oct 26, 2026')).toBeInTheDocument();
    const flag = screen.getByText('Overdue by 3 days');
    expect(flag.closest('.text-danger')).not.toBeNull();
    const icon = container.querySelector('svg.lucide-triangle-alert');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
    await expectNoAxeViolations(container);
  });
});
