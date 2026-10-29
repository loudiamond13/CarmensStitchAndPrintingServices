import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import type { AuditLogItem } from '@/modules/admin/services/auditLogService';
import { AuditDetail } from './AuditDetail';

// The expandable audit row's detail (D-27, D-40): a description list in the RecordMeta look.

function entry(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: 7,
    occurredAt: '2026-10-17T07:42:00Z',
    doneBy: {
      kind: 'user',
      person: { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Carmen Reyes', formerStaff: false },
    },
    action: 'user.role-changed',
    doneTo: { id: '00000000-0000-4000-8000-000000000002', name: 'Paolo Garcia', formerStaff: false },
    detail: 'role=admin>manager',
    ipPrefix: '203.0.113.0/24',
    device: 'Chrome on Android',
    reference: 'c0ffee00-1111-4222-8333-444455556666',
    changes: [],
    snapshot: null,
    orderSnapshot: null,
    orderNumber: null,
    ...overrides,
  };
}

function termsOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll('dt')].map((term) => term.textContent);
}

function valueOf(container: HTMLElement, term: string): HTMLElement {
  const dt = [...container.querySelectorAll('dt')].find((candidate) => candidate.textContent === term);
  const dd = dt?.nextElementSibling;
  if (!(dd instanceof HTMLElement)) {
    throw new Error(`No value for ${term}`);
  }
  return dd;
}

describe('AuditDetail', () => {
  it('lists What changed, IP address, Device and Reference as a description list', () => {
    const { container } = render(<AuditDetail item={entry()} />);

    expect(container.querySelector('dl')).not.toBeNull();
    expect(termsOf(container)).toEqual(['What changed', 'IP address', 'Device', 'Reference']);
    expect(valueOf(container, 'What changed')).toHaveTextContent('Role: Admin to Manager');
    expect(valueOf(container, 'IP address')).toHaveTextContent('203.0.113.0/24');
    expect(valueOf(container, 'Device')).toHaveTextContent('Chrome on Android');
    expect(valueOf(container, 'Reference')).toHaveTextContent('c0ffee00-1111-4222-8333-444455556666');
  });

  it('leaves out What changed when there is nothing to say', () => {
    const { container } = render(<AuditDetail item={entry({ action: 'user.deactivated', detail: null })} />);

    expect(termsOf(container)).toEqual(['IP address', 'Device', 'Reference']);
  });

  it('leaves out What changed for words it does not know', () => {
    const { container } = render(<AuditDetail item={entry({ detail: 'something-new' })} />);

    expect(termsOf(container)).not.toContain('What changed');
  });

  it('shows the empty-value icon with "Not set" for no IP address', () => {
    const { container } = render(<AuditDetail item={entry({ ipPrefix: null })} />);

    const value = valueOf(container, 'IP address');
    expect(within(value).getByText('Not set')).toBeInTheDocument();
    expect(value.querySelector('svg')).not.toBeNull();
  });

  it('shows "Unknown browser" for no device and for the stored word Unknown', () => {
    const none = render(<AuditDetail item={entry({ device: null })} />);
    expect(valueOf(none.container, 'Device')).toHaveTextContent('Unknown browser');
    none.unmount();

    const stored = render(<AuditDetail item={entry({ device: 'Unknown' })} />);
    expect(valueOf(stored.container, 'Device')).toHaveTextContent('Unknown browser');
  });

  it('lets a long reference wrap anywhere instead of widening the row', () => {
    const { container } = render(<AuditDetail item={entry({ reference: 'x'.repeat(200) })} />);

    expect(valueOf(container, 'Reference').className).toContain('wrap-anywhere');
  });

  it('renders every value as text, never as markup', () => {
    const { container } = render(
      <AuditDetail item={entry({ device: '<img src=x onerror=alert(1)>', reference: '<b>bold</b>' })} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(valueOf(container, 'Device')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });

  it('never shows a name or an email from a stored detail that holds one (D-40)', () => {
    render(<AuditDetail item={entry({ action: 'user.details-changed', detail: 'fields=carmen@example.ph' })} />);

    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText('What changed')).toBeNull();
  });

  it('lists the change lines of an expense entry and never the raw detail (D-27)', () => {
    const { container } = render(
      <AuditDetail
        item={entry({
          action: 'company-expense.changed',
          detail: 'amount=1200.00>1250.00;fields=description;payer=00000000-0000-4000-8000-000000000002',
          changes: [
            { field: 'amount', from: '1200.00', to: '1250.00', fromPerson: null, toPerson: null },
            { field: 'description', from: null, to: null, fromPerson: null, toPerson: null },
          ],
        })}
      />,
    );

    const value = valueOf(container, 'What changed');
    expect(
      within(value)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Amount: ₱1,200.00 to ₱1,250.00', 'Description changed']);
    expect(container).not.toHaveTextContent('1200.00>1250.00');
    expect(container).not.toHaveTextContent('payer=');
  });

  it('names the order and reads the lines of an added payment as stated values (D-31)', () => {
    const ana = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Reyes', formerStaff: false };
    const { container } = render(
      <AuditDetail
        item={entry({
          action: 'order-payment.added',
          doneTo: null,
          detail: 'payment=x;receiver=y',
          orderNumber: 'ORD-2026-0148',
          changes: [
            { field: 'date', from: null, to: '2026-10-25', fromPerson: null, toPerson: null },
            { field: 'amount', from: null, to: '10000.00', fromPerson: null, toPerson: null },
            { field: 'method', from: null, to: 'GCash', fromPerson: null, toPerson: null },
            { field: 'receiver', from: null, to: null, fromPerson: null, toPerson: ana },
          ],
        })}
      />,
    );

    expect(termsOf(container)).toEqual(['Order', 'What changed', 'IP address', 'Device', 'Reference']);
    expect(valueOf(container, 'Order')).toHaveTextContent('ORD-2026-0148');
    expect(
      within(valueOf(container, 'What changed'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Date: Oct 25, 2026', 'Amount: ₱10,000.00', 'Payment method: GCash', 'Received by: Ana Reyes']);
    expect(container).not.toHaveTextContent('payment=x');
  });

  it('reads a receiver change as before and after, and an edit as a pair even with no old value', () => {
    const ana = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Reyes', formerStaff: false };
    const bea = { id: '22222222-2222-4222-8222-222222222222', name: 'Bea Navarro', formerStaff: true };
    const { container } = render(
      <AuditDetail
        item={entry({
          action: 'order-payment.receiver-changed',
          detail: 'payment=x;receiver=a>b',
          orderNumber: 'ORD-2026-0148',
          changes: [
            { field: 'receiver', from: null, to: null, fromPerson: ana, toPerson: bea },
            { field: 'method', from: null, to: 'GCash', fromPerson: null, toPerson: null },
          ],
        })}
      />,
    );

    expect(
      within(valueOf(container, 'What changed'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Received by: Ana Reyes to Bea Navarro (former staff)',
      'Payment method: a deleted payment method to GCash',
    ]);
  });

  it('reads the snapshot of a deleted order after the order is gone (ORD-16)', () => {
    const { container } = render(
      <AuditDetail
        item={entry({
          action: 'order.permanently-deleted',
          doneTo: null,
          detail: 'number=ORD-2026-0148;status=cancelled',
          orderNumber: 'ORD-2026-0148',
          orderSnapshot: { number: 'ORD-2026-0148', status: 'cancelled', total: 21327.5, paid: 12000, balance: 9327.5 },
        })}
      />,
    );

    expect(valueOf(container, 'What changed')).toHaveTextContent(
      'ORD-2026-0148, Cancelled, total ₱21,327.50, paid ₱12,000.00, balance ₱9,327.50',
    );
    expect(container).not.toHaveTextContent('status=');
  });

  it('leaves out the Order row for an entry that is not about an order', () => {
    const { container } = render(<AuditDetail item={entry({ orderNumber: null })} />);

    expect(termsOf(container)).not.toContain('Order');
  });

  it('has no axe violations', async () => {
    const { container } = render(<AuditDetail item={entry()} />);

    await expectNoAxeViolations(container);
  });

  it('has no axe violations for an order entry with its lines and snapshot', async () => {
    const { container } = render(
      <AuditDetail
        item={entry({
          action: 'order.deleted',
          doneTo: null,
          detail: null,
          orderNumber: 'ORD-2026-0148',
          orderSnapshot: { number: 'ORD-2026-0148', status: 'pending', total: 100, paid: 0, balance: 100 },
          changes: [{ field: 'customerName', from: null, to: null, fromPerson: null, toPerson: null }],
        })}
      />,
    );

    await expectNoAxeViolations(container);
  });
});
