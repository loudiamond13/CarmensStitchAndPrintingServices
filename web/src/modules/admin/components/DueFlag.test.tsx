import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { DueFlag } from './DueFlag';

// DueFlag (ORD-11, D-36 to D-38, UIC-8, UIC-51, UIC-53, UIC-58): the due date and its flag, from the server's business today.

const TODAY = '2026-10-29';

describe('DueFlag', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Overdue by 3 days with the alert icon and the danger color for ORD-2026-0153', async () => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-10-26" status="production" />);

    expect(screen.getByText('Due Oct 26, 2026')).toBeInTheDocument();
    const flag = screen.getByText('Overdue by 3 days');
    expect(flag.closest('.text-danger')).not.toBeNull();
    const icon = container.querySelector('svg.lucide-triangle-alert');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
    await expectNoAxeViolations(container);
  });

  it.each([
    ['2026-11-03', 'Due Nov 3, 2026', '5 days left'],
    ['2026-10-31', 'Due Oct 31, 2026', '2 days left'],
    ['2026-10-30', 'Due Oct 30, 2026', 'Due tomorrow'],
    ['2026-10-29', 'Due Oct 29, 2026', 'Due today'],
    ['2026-10-28', 'Due Oct 28, 2026', 'Overdue by 1 day'],
    ['2026-10-26', 'Due Oct 26, 2026', 'Overdue by 3 days'],
  ])('an open order due %s reads %s and %s', async (dueDate, date, flag) => {
    const { container } = render(<DueFlag today={TODAY} dueDate={dueDate} status="ready" />);

    expect(screen.getByText(date)).toBeInTheDocument();
    expect(screen.getByText(flag)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('draws the alert icon only when the order is overdue', () => {
    const { container, rerender } = render(<DueFlag today={TODAY} dueDate="2026-10-29" status="pending" />);
    expect(container.querySelector('svg')).toBeNull();

    rerender(<DueFlag today={TODAY} dueDate="2026-10-28" status="pending" />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('shows days left in muted ink and today and tomorrow in bold ink', () => {
    render(
      <>
        <DueFlag today={TODAY} dueDate="2026-11-03" status="pending" />
        <DueFlag today={TODAY} dueDate="2026-10-30" status="pending" />
        <DueFlag today={TODAY} dueDate="2026-10-29" status="pending" />
      </>,
    );

    expect(screen.getByText('5 days left').className).toContain('text-ink-muted');
    for (const text of ['Due tomorrow', 'Due today']) {
      const flag = screen.getByText(text);
      expect(flag.className).toContain('text-ink');
      expect(flag.className).toContain('font-semibold');
    }
  });

  it.each(['delivered', 'completed', 'cancelled'])('a %s order past due shows only the date', (status) => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-10-01" status={status} />);

    expect(container).toHaveTextContent('Due Oct 1, 2026');
    expect(container).not.toHaveTextContent(/overdue|left|tomorrow|today/i);
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each(['pending', 'delivered'])(
    'an imported %s order with no due date shows EmptyValue and no flag',
    async (status) => {
      const { container } = render(<DueFlag today={TODAY} dueDate={null} status={status} />);

      expect(container).toHaveTextContent('Due Not set');
      expect(container.querySelectorAll('svg.lucide-minus')).toHaveLength(1);
      expect(container.querySelectorAll('svg')).toHaveLength(1);
      expect(container).not.toHaveTextContent(/overdue|left|tomorrow|today/i);
      await expectNoAxeViolations(container);
    },
  );

  it('shows EmptyValue for a due date that is not a real day', () => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-02-30" status="pending" />);

    expect(container).toHaveTextContent('Due Not set');
    expect(container).not.toHaveTextContent(/overdue|left/i);
  });

  function expectTomorrow(): void {
    render(<DueFlag today={TODAY} dueDate="2026-10-30" status="pending" />);

    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('Due today')).toBeNull();
  }

  it('reads Due tomorrow at 23:30 Manila because only the today prop counts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T15:30:00Z'));

    expectTomorrow();
  });

  it('reads Due tomorrow at 00:30 Manila the next day because only the today prop counts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T16:30:00Z'));

    expectTomorrow();
  });

  it('stacks the flag under the date with the 4px gap', () => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-10-26" status="pending" layout="stacked" />);

    const root = container.firstElementChild;
    expect(root?.className).toContain('flex-col');
    expect(root?.className).toContain('gap-1');
    expect(root?.children[0]).toHaveTextContent('Due Oct 26, 2026');
    expect(root?.children[1]).toHaveTextContent('Overdue by 3 days');
    expect(container).not.toHaveTextContent('·');
  });

  it('joins the date and the flag with a dot inline, and hides the dot from assistive technology', () => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-10-26" status="pending" layout="inline" />);

    expect(container).toHaveTextContent('Due Oct 26, 2026 · Overdue by 3 days');
    expect(screen.getByText('·')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is inline by default and has no dot when there is no flag', () => {
    const { container } = render(<DueFlag today={TODAY} dueDate="2026-10-01" status="completed" />);

    expect(container).toHaveTextContent(/^Due Oct 1, 2026$/);
  });
});
