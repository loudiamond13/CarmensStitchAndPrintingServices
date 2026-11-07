import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import type { MyMoney } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import { MY_MONEY_USER_ID } from '@/test/moneyFixtures';

// The My Money balance card (D-39, D-21, MONEY-02): the overline, the server figure at the large size, and what the figure is
// made of. It works out nothing.

function queryOf(overrides: Partial<MyMoneyCardQuery> = {}): MyMoneyCardQuery {
  return { data: undefined, isError: false, error: null, refetch: vi.fn(), ...overrides };
}

function moneyOf(balance: number): MyMoney {
  return { userId: MY_MONEY_USER_ID, name: 'Liza Mercado', balance, today: '2026-11-04' };
}

describe('the card with a figure (D-39)', () => {
  it('reads "Money on hand" over the figure and the explanation of what it is made of', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    expect(screen.getByText('Money on hand')).toBeVisible();
    expect(screen.getByText('₱8,450.00')).toBeVisible();
    expect(
      screen.getByText(
        'Payments received and transfers in, minus transfers out, expenses paid and refunds handed back.',
      ),
    ).toBeVisible();
  });

  it('shows the figure at the large display size (Money lg)', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    expect(screen.getByText('₱8,450.00').className).toContain('text-[40px]');
  });

  it('puts the overline, the figure and the line in that order', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    const overline = screen.getByText('Money on hand');
    const figure = screen.getByText('₱8,450.00');
    const line = screen.getByText(/^Payments received/);
    expect(overline.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(figure.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a balance below zero as a negative figure with the true minus sign in the danger tone (D-21)', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(-500) })} />);

    const figure = screen.getByText('−₱500.00');
    expect(figure.className).toContain('text-danger');
  });

  it('shows ₱0.00 in the zero dim and not in the danger tone (D-39)', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(0) })} />);

    const figure = screen.getByText('₱0.00');
    expect(figure.className).toContain('text-ink-subtle');
    expect(figure.className).not.toContain('text-danger');
  });

  it('keeps a positive figure in the plain ink', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    const figure = screen.getByText('₱8,450.00');
    expect(figure.className).not.toContain('text-danger');
    expect(figure.className).not.toContain('text-ink-subtle');
  });

  it('has no axe violations', async () => {
    const { container } = render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    await expectNoAxeViolations(container);
  });
});

describe('the figure as given (no arithmetic in the card)', () => {
  it.each([
    [0.1, '₱0.10'],
    [1234.5, '₱1,234.50'],
    [-0.5, '−₱0.50'],
  ])('writes %s as %s and nothing else', (balance, text) => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(balance) })} />);

    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getAllByText(/₱/)).toHaveLength(1);
  });
});

// jsdom evaluates no container query, so the clamp is pinned as a class here and as generated CSS in money.recipe.node.test.ts.
describe('very large figures (UI-SPEC overflow rows)', () => {
  it('keeps the large size for an ordinary figure and for 14 characters', () => {
    const { rerender } = render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);
    expect(screen.getByText('₱8,450.00').className).not.toContain('clamp');

    rerender(<MoneyOnHandCard query={queryOf({ data: moneyOf(99999999.99) })} />);
    expect(screen.getByText('₱99,999,999.99').className).not.toContain('clamp');
  });

  it('shrinks a figure of 15 characters or more with the card width, as the KPI cards do, so it stays inside the card', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(999999999.99) })} />);

    const figure = screen.getByText('₱999,999,999.99');
    expect(figure.className).toContain('text-[length:clamp(22px,13.5cqi,40px)]!');
    expect(figure.className).toContain('whitespace-nowrap');
  });

  it('shrinks a negative figure of 15 characters or more the same way', () => {
    render(<MoneyOnHandCard query={queryOf({ data: moneyOf(-99999999.99) })} />);

    expect(screen.getByText('−₱99,999,999.99').className).toContain('clamp(22px,13.5cqi,40px)');
  });

  it('measures the card body, so the clamp follows the card and not the page', () => {
    const { container } = render(<MoneyOnHandCard query={queryOf({ data: moneyOf(8450) })} />);

    const body = screen.getByText('Money on hand').parentElement;
    expect(body?.className.split(' ')).toContain('@container');
    expect(container.querySelector('section')).toContainElement(body);
  });
});

describe('loading (UI-SPEC M1 MoneyOnHandCard)', () => {
  it('announces "Loading money on hand…" and shows the 220 x 40 skeleton in a busy region', () => {
    const { container } = render(<MoneyOnHandCard query={queryOf()} />);

    expect(screen.getByText('Loading money on hand…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const skeleton = Array.from(container.querySelectorAll<HTMLElement>('span')).find(
      (element) => element.style.getPropertyValue('--sk-w') === '220px',
    );
    expect(skeleton?.style.getPropertyValue('--sk-h')).toBe('40px');
    expect(screen.queryByText(/₱/)).toBeNull();
  });

  it('keeps the overline while it loads, so the card says what is coming', () => {
    render(<MoneyOnHandCard query={queryOf()} />);

    expect(screen.getByText('Money on hand')).toBeVisible();
  });
});

describe('failure (UI-SPEC M1 MoneyOnHandCard)', () => {
  it('says "Couldn\'t load the money on hand." in an alert with Try Again, and shows no figure', () => {
    render(<MoneyOnHandCard query={queryOf({ isError: true, error: new Error('x') })} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the money on hand.");
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeVisible();
    expect(screen.queryByText(/₱/)).toBeNull();
  });

  it('asks the server again when Try Again is pressed', async () => {
    const refetch = vi.fn();
    render(<MoneyOnHandCard query={queryOf({ isError: true, error: new Error('x'), refetch })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations', async () => {
    const { container } = render(<MoneyOnHandCard query={queryOf({ isError: true, error: new Error('x') })} />);

    await expectNoAxeViolations(container);
  });
});
