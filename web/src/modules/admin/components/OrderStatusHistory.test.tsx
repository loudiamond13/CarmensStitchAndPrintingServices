import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OrderStatusHistory } from '@/modules/admin/components/OrderStatusHistory';
import { expectNoAxeViolations } from '@/test/axe';
import { order0148, ORDER_STAFF, ORDER_STAFF_TWO, type OrderDetailFixture } from '@/test/orderFixtures';

// The status history card of the order page (D-17, D-50; plan 08-12): newest first, "{From} to {To}" over "{name} · {date}",
// the create row reads "Created as {Status}", and only the newest 5 show until Show All.

type Change = OrderDetailFixture['statusHistory'][number];

/** A history of `count` rows, oldest first as the server sends it: Pending, then a move each day. */
function historyOf(count: number): Change[] {
  const statuses = ['pending', 'mockup', 'production', 'ready', 'delivered', 'completed', 'ready'];
  return statuses.slice(0, count).map((to, index) => ({
    from: index === 0 ? null : (statuses[index - 1] ?? null),
    to,
    changedAt: `2026-10-${String(index + 1).padStart(2, '0')}T02:00:00Z`,
    changedBy: ORDER_STAFF,
  }));
}

/** The list items, in order. */
function rows(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('the status history (D-17)', () => {
  it('heads the card with Status history', () => {
    render(<OrderStatusHistory history={order0148.statusHistory} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Status history' })).toBeVisible();
  });

  it('lists newest first: from to to over the name and the date (UIC-39)', () => {
    render(<OrderStatusHistory history={order0148.statusHistory} />);

    const [newest, oldest] = rows();
    if (newest === undefined || oldest === undefined) throw new Error('Expected two history rows');
    expect(newest).toHaveTextContent('Pending to In Production');
    expect(newest).toHaveTextContent('Carmen Reyes · Oct 1, 2026');
    expect(oldest).toHaveTextContent('Created as Pending');
    expect(oldest).toHaveTextContent('Carmen Reyes · Sep 28, 2026');
  });

  it('writes the date in a time element', () => {
    render(<OrderStatusHistory history={order0148.statusHistory} />);

    const [newest] = rows();
    if (newest === undefined) throw new Error('Expected a history row');
    const time = newest.querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-10-01T02:00:00Z');
    expect(time).toHaveTextContent('Oct 1, 2026');
  });

  it('reads System when no person made the change', () => {
    const history: Change[] = [{ from: null, to: 'pending', changedAt: '2026-09-28T02:00:00Z', changedBy: null }];
    render(<OrderStatusHistory history={history} />);

    expect(rows()[0]).toHaveTextContent('System · Sep 28, 2026');
  });

  it('names a person whose account was deleted with (former staff)', () => {
    const history: Change[] = [
      {
        from: null,
        to: 'pending',
        changedAt: '2026-09-28T02:00:00Z',
        changedBy: { ...ORDER_STAFF_TWO, formerStaff: true },
      },
    ];
    render(<OrderStatusHistory history={history} />);

    expect(rows()[0]).toHaveTextContent('Paolo Garcia (former staff) · Sep 28, 2026');
  });

  it('shows only the create row as Created as {Status} and no Show All (UIC-11)', () => {
    render(<OrderStatusHistory history={historyOf(1)} />);

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Created as Pending');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows five rows and no button for a history of five', () => {
    render(<OrderStatusHistory history={historyOf(5)} />);

    expect(rows()).toHaveLength(5);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the newest five and Show All 7 for a history of seven (D-50)', () => {
    render(<OrderStatusHistory history={historyOf(7)} />);

    const shown = rows();
    expect(shown).toHaveLength(5);
    expect(shown[0]).toHaveTextContent('Completed to Ready');
    expect(shown[4]).toHaveTextContent('Mockup to In Production');
    expect(screen.getByRole('button', { name: 'Show All 7' })).toBeVisible();
  });

  it('expands in place, reads Show Fewer, keeps focus on the button and folds back', async () => {
    const user = userEvent.setup();
    render(<OrderStatusHistory history={historyOf(7)} />);

    await user.click(screen.getByRole('button', { name: 'Show All 7' }));

    expect(rows()).toHaveLength(7);
    const fewer = screen.getByRole('button', { name: 'Show Fewer' });
    expect(fewer).toHaveFocus();
    expect(fewer).toHaveAttribute('aria-expanded', 'true');
    expect(rows()[6]).toHaveTextContent('Created as Pending');

    await user.click(fewer);

    expect(rows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show All 7' })).toHaveFocus();
  });

  it('has no axe violations', async () => {
    const { container } = render(<OrderStatusHistory history={historyOf(7)} />);

    await expectNoAxeViolations(container);
  });
});
