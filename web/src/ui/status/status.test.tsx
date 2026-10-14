import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as statusScenarios } from '@/dev/scenarios/groups/status';
import { ORDER_STATUSES, type ExpenseCategory, type OrderStatus, type PaymentMethod } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import {
  Avatar,
  Badge,
  EXPENSE_TONE,
  isOrderStatus,
  PAYMENT_TONE,
  STATUS_TONE,
  StatusBadge,
  type BadgeTone,
} from '@/ui/status';
import { avatarClasses, avatarContextClasses, badgeClasses, badgeDotClasses, badgeToneClasses } from './status.recipe';

// The converted App. D.3 status components (plan 02-19, CSPS-UI-SPEC.md §6.2). The look is proven by the parity suite
// (`--grep @status`); these tests pin the markup, the tone tables, the recipe each tone uses and the status scenario
// set the parity suite compares.

const TONES = [
  'neutral',
  'accent',
  'success',
  'warning',
  'info',
  'mockup',
  'danger',
  'solid',
] as const satisfies readonly BadgeTone[];
const STATUSES = Object.keys(ORDER_STATUSES) as OrderStatus[];

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function lookFor(tone: BadgeTone): string[] {
  return tokens(`${badgeClasses} ${badgeToneClasses[tone]}`);
}

describe('Badge (App. D.3)', () => {
  it('renders a span holding its text, in the badge look of its tone', () => {
    render(<Badge tone="success">Paid</Badge>);
    const badge = screen.getByText('Paid');

    expect(badge.localName).toBe('span');
    expect(badge.children).toHaveLength(0);
    expect(classTokens(badge)).toEqual(lookFor('success'));
  });

  it('defaults to the neutral tone, as App. D.3 does', () => {
    render(<Badge>Inactive</Badge>);

    expect(classTokens(screen.getByText('Inactive'))).toEqual(lookFor('neutral'));
  });

  it.each(TONES)('gives the %s tone its own complete background and ink', (tone) => {
    render(<Badge tone={tone}>Label</Badge>);

    expect(classTokens(screen.getByText('Label'))).toEqual(lookFor(tone));
    expect(badgeToneClasses[tone]).toMatch(/^bg-\S+ text-\S+$/);
  });

  it('puts a hidden 7px dot first when `dot` is set', () => {
    render(
      <Badge tone="success" dot>
        Active
      </Badge>,
    );
    const badge = screen.getByText('Active');
    const dot = badge.firstElementChild;

    expect(badge.children).toHaveLength(1);
    expect(dot?.localName).toBe('span');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(classTokens(dot)).toEqual(tokens(badgeDotClasses));
    expect(dot?.textContent).toBe('');
  });

  it('renders a 14px icon hidden from assistive technology, after the dot', () => {
    render(
      <Badge tone="accent" dot icon="shield-check">
        Manager only
      </Badge>,
    );
    const badge = screen.getByText('Manager only');
    const [dot, icon] = [...badge.children];

    expect(badge.children).toHaveLength(2);
    expect(dot?.localName).toBe('span');
    expect(icon?.localName).toBe('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
    expect(icon).toHaveClass('lucide-shield-check');
    expect(badge).toHaveAccessibleName('');
    expect(badge.textContent).toBe('Manager only');
  });

  it('adds a caller layout class after the look', () => {
    render(
      <Badge tone="info" className="ml-2">
        GCash
      </Badge>,
    );

    expect(classTokens(screen.getByText('GCash'))).toEqual(tokens(`${badgeClasses} ${badgeToneClasses.info} ml-2`));
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Badge tone="info">GCash</Badge>);
    const first = container.innerHTML;

    rerender(<Badge tone="info">GCash</Badge>);
    expect(container.innerHTML).toBe(first);

    rerender(
      <Badge tone="danger" dot icon="triangle-alert">
        Overdue
      </Badge>,
    );
    expect(classTokens(screen.getByText('Overdue'))).toEqual(lookFor('danger'));
  });
});

describe('StatusBadge (App. D.3)', () => {
  it.each(STATUSES)('shows the %s label in its tone with a dot', (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(ORDER_STATUSES[status]);

    expect(classTokens(badge)).toEqual(lookFor(STATUS_TONE[status]));
    expect(badge.children).toHaveLength(1);
    expect(classTokens(badge.firstElementChild)).toEqual(tokens(badgeDotClasses));
    expect(badge.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('defaults to Pending', () => {
    render(<StatusBadge />);

    expect(classTokens(screen.getByText('Pending'))).toEqual(lookFor('neutral'));
  });

  it('shows a status it does not know as it is, in the neutral tone (T-02-49)', () => {
    // A status string from the API that the OrderStatus union does not know.
    const fromApi = 'on-hold' as string as OrderStatus;
    render(<StatusBadge status={fromApi} />);

    expect(classTokens(screen.getByText('on-hold'))).toEqual(lookFor('neutral'));
  });

  it('never treats an inherited object key as a status', () => {
    expect(isOrderStatus('production')).toBe(true);
    expect(isOrderStatus('toString')).toBe(false);
    expect(isOrderStatus('')).toBe(false);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<StatusBadge status="ready" />);
    const first = container.innerHTML;

    rerender(<StatusBadge status="ready" />);
    expect(container.innerHTML).toBe(first);

    rerender(<StatusBadge status="cancelled" className="ml-2" />);
    expect(classTokens(screen.getByText('Cancelled'))).toEqual(tokens(`${lookFor('danger').join(' ')} ml-2`));
  });
});

describe('Avatar (App. D.3, D-31 O-1)', () => {
  it('shows the initials of the first two words as one image named for the person', () => {
    render(<Avatar name="Carmen Reyes" size={40} />);
    const avatar = screen.getByRole('img', { name: 'Carmen Reyes' });

    expect(avatar.localName).toBe('span');
    expect(avatar.textContent).toBe('CR');
    expect(avatar.children).toHaveLength(0);
  });

  it('uses only the first two words, upper-cased, and ignores extra spaces', () => {
    render(<Avatar name="  jomar   dela santos " />);

    expect(screen.getByRole('img').textContent).toBe('JD');
  });

  it('sets only --avatar-size and --avatar-fs in style, read by the size and font-size utilities', () => {
    render(<Avatar name="Carmen Reyes" size={40} />);
    const avatar = screen.getByRole('img');

    expect([...avatar.style].sort()).toEqual(['--avatar-fs', '--avatar-size']);
    expect(avatar.style.getPropertyValue('--avatar-size')).toBe('40px');
    expect(avatar.style.getPropertyValue('--avatar-fs')).toBe('15px');
    expect(classTokens(avatar)).toEqual(
      tokens(`${avatarClasses} ${avatarContextClasses.default} size-(--avatar-size) text-(length:--avatar-fs)`),
    );
  });

  it('takes the sidebar chip look in the sidebar context (App. B .csp-sidebar .csp-avatar, plan 02-26)', () => {
    render(<Avatar name="Carmen Reyes" size={32} context="sidebar" />);
    const avatar = screen.getByRole('img');

    expect(classTokens(avatar)).toEqual(
      tokens(`${avatarClasses} ${avatarContextClasses.sidebar} size-(--avatar-size) text-(length:--avatar-fs)`),
    );
    expect(tokens(avatarContextClasses.sidebar)).toEqual(['bg-surface-3', 'leading-4', 'text-ink']);
    expect(tokens(avatarContextClasses.default)).toEqual(['bg-surface-2', 'text-ink']);
    expect(tokens(avatarContextClasses.cellUser)).toEqual(['bg-surface-2', 'text-ink-muted']);
    expect(tokens(avatarClasses)).not.toContain('text-ink');
  });

  it.each([
    [24, '10px'],
    [32, '12px'],
    [36, '14px'],
    [56, '21px'],
    [72, '27px'],
  ])('sizes a %ipx avatar with max(10, round(size x .38)) = %s text (App. D.3)', (size, fontSize) => {
    render(<Avatar name="Carmen Reyes" size={size} />);
    const avatar = screen.getByRole('img');

    expect(avatar.style.getPropertyValue('--avatar-size')).toBe(`${String(size)}px`);
    expect(avatar.style.getPropertyValue('--avatar-fs')).toBe(fontSize);
  });

  it('defaults to 36px, as App. D.3 does, and adds a caller layout class after the look', () => {
    render(<Avatar name="Carmen Reyes" className="ml-2" />);
    const avatar = screen.getByRole('img');

    expect(avatar.style.getPropertyValue('--avatar-size')).toBe('36px');
    expect(classTokens(avatar)).toContain('ml-2');
  });

  it('renders an empty 36px circle without a name (App. D.3 defaults)', () => {
    const { container } = render(<Avatar />);
    const avatar = container.firstElementChild;

    expect(avatar?.textContent).toBe('');
    expect(avatar).toHaveAttribute('aria-label', '');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Avatar name="Carmen Reyes" size={32} />);

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Avatar name="Carmen Reyes" size={40} />);
    const first = container.innerHTML;

    rerender(<Avatar name="Carmen Reyes" size={40} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Avatar name="Jomar Santos" size={24} />);
    const avatar = screen.getByRole('img', { name: 'Jomar Santos' });
    expect(avatar.textContent).toBe('JS');
    expect(avatar.style.getPropertyValue('--avatar-fs')).toBe('10px');
  });
});

describe('the §6.2 tone tables', () => {
  it('gives each order status its spec tone', () => {
    expect(STATUS_TONE).toEqual({
      pending: 'neutral',
      mockup: 'mockup',
      production: 'warning',
      ready: 'info',
      completed: 'success',
      cancelled: 'danger',
    });
  });

  it('gives each payment method its spec tone', () => {
    expect(PAYMENT_TONE).toEqual({ GCash: 'info', Maya: 'success', Cash: 'neutral', 'Bank Transfer': 'mockup' });
  });

  it('gives each company expense category its spec tone', () => {
    expect(EXPENSE_TONE).toEqual({
      Rent: 'accent',
      Utilities: 'info',
      Salaries: 'mockup',
      Supplies: 'warning',
      Equipment: 'success',
      Maintenance: 'neutral',
      Others: 'neutral',
    });
  });
});

describe('status scenarios (the status parity group)', () => {
  const byId = new Map(statusScenarios.map((scenario) => [scenario.id, scenario]));
  const badgeScenarios = statusScenarios.filter((scenario) => scenario.node.component !== 'Avatar');

  function slug(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '-');
  }

  it('declares one Badge per tone, the dot and icon forms, one StatusBadge per status and every payment and expense badge', () => {
    const expected = [
      ...TONES.map((tone) => `badge-${tone}`),
      'badge-success-dot',
      'badge-accent-icon',
      ...STATUSES.map((status) => `status-badge-${status}`),
      ...Object.keys(PAYMENT_TONE).map((method) => `payment-badge-${slug(method)}`),
      ...Object.keys(EXPENSE_TONE).map((category) => `expense-badge-${slug(category)}`),
    ];

    expect(badgeScenarios.map((scenario) => scenario.id).sort()).toEqual(expected.sort());
  });

  it('compares every badge in both themes at rest only', () => {
    for (const scenario of badgeScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.responsive, scenario.id).toBe(false);
    }
  });

  it('sets each tone, status, payment and expense scenario to the tone its table gives', () => {
    for (const tone of TONES) {
      expect(byId.get(`badge-${tone}`)?.node.props, tone).toMatchObject({ tone });
    }
    for (const status of STATUSES) {
      expect(byId.get(`status-badge-${status}`)?.node, status).toEqual({
        kind: 'node',
        component: 'StatusBadge',
        props: { status },
      });
    }
    for (const [method, tone] of Object.entries(PAYMENT_TONE) as [PaymentMethod, BadgeTone][]) {
      expect(byId.get(`payment-badge-${slug(method)}`)?.node.props, method).toEqual({ tone, children: method });
    }
    for (const [category, tone] of Object.entries(EXPENSE_TONE) as [ExpenseCategory, BadgeTone][]) {
      expect(byId.get(`expense-badge-${slug(category)}`)?.node.props, category).toEqual({ tone, children: category });
    }
  });

  it('declares Avatar at 24, 32, 40 and 56 px, at rest in both themes', () => {
    const avatars = statusScenarios.filter((scenario) => scenario.node.component === 'Avatar');

    expect(avatars.map((scenario) => scenario.id)).toEqual(['avatar-24', 'avatar-32', 'avatar-40', 'avatar-56']);
    for (const scenario of avatars) {
      expect(scenario.node.props, scenario.id).toEqual({ name: 'Carmen Reyes', size: Number(scenario.id.slice(7)) });
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });

  it('renders every status scenario through the implementation kit with no axe violations', async () => {
    const { container } = render(
      <div>
        {statusScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(screen.getAllByRole('img', { name: 'Carmen Reyes' })).toHaveLength(4);
    for (const status of STATUSES) {
      expect(container.querySelector(`[data-case="status-badge-${status}"]`)?.textContent).toBe(ORDER_STATUSES[status]);
    }
    await expectNoAxeViolations(container);
  });
});
