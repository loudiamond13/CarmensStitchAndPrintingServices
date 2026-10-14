import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component, useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { collectConsole } from '@/test/consoleGuard';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/ui/lists';
import { ConfirmDialog, Modal, Overlay } from '@/ui/overlays';
import { PaintContainmentContext, useFixedLayerGuard } from './fixedLayerGuard';

// Code review WR-05 (02-REVIEW-d41.md): the ResponsiveTable frame keeps its D-41 R2-02 paint containment, which makes
// it the containing block of `position: fixed` descendants, so a dialog rendered in a cell would get a scrim that
// covers only the table and a panel that scrolls with the rows. Overlays render in place inside the page root (spec
// §2.7, D-33; never a portal), so the frame provides PaintContainmentContext and an open Modal (ConfirmDialog and an
// Overlay's inline Modal included) refuses to render there. A row action keeps the dialog's open state on the page and
// renders the dialog outside the table, which is the supported pattern.

interface Order {
  id: string;
  number: string;
}

const ORDERS: readonly Order[] = [
  { id: 'o1', number: 'ORD-2026-0148' },
  { id: 'o2', number: 'ORD-2026-0151' },
];

const CAPTION = 'Orders';

function OrdersTable({ actions }: { actions: (order: Order) => ReactNode }) {
  const columns: readonly ResponsiveTableColumn<Order>[] = [
    { key: 'number', header: 'Order', lead: true, cell: (order) => order.number },
    { key: 'actions', header: 'Actions', actions: true, cell: actions },
  ];
  return (
    <ResponsiveTable<Order>
      caption={CAPTION}
      columns={columns}
      rows={ORDERS}
      rowKey={(order) => order.id}
      things="orders"
    />
  );
}

interface CatchState {
  error: Error | null;
}

/** A minimal test error boundary: shows the caught message, so the throw is checked without an uncaught error. */
class Catch extends Component<{ children: ReactNode }, CatchState> {
  override state: CatchState = { error: null };

  static getDerivedStateFromError(error: unknown): CatchState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override render(): ReactNode {
    const { error } = this.state;
    return error === null ? this.props.children : <p data-testid="caught">{error.message}</p>;
  }
}

/** React's development reports may only be about the guard's error (as ErrorBoundary.test.tsx checks). */
function expectOnlyGuardReports(): void {
  const calls = collectConsole();
  for (const call of calls) {
    expect(
      call.args.some((argument) => argument instanceof Error && argument.message.includes('code review WR-05')),
    ).toBe(true);
  }
}

function caughtMessage(): string {
  return screen.getByTestId('caught').textContent;
}

function expectGuardMessage(message: string, component: string): void {
  expect(message).toContain(`${component} cannot render inside a ResponsiveTable frame`);
  expect(message).toContain('paint containment (D-41 R2-02) traps position: fixed');
  expect(message).toContain("Keep the dialog's open state on the page and render the dialog outside the table");
  expect(message).toContain('code review WR-05');
}

describe('overlays inside the paint-contained ResponsiveTable frame (code review WR-05)', () => {
  it('refuses an open ConfirmDialog rendered in a cell', () => {
    render(
      <Catch>
        <OrdersTable
          actions={(order) => <ConfirmDialog title={`Delete ${order.number}?`} onCancel={() => undefined} />}
        />
      </Catch>,
    );

    expectGuardMessage(caughtMessage(), 'Modal');
    expect(screen.queryByRole('dialog')).toBeNull();
    expectOnlyGuardReports();
  });

  it('refuses an open Modal rendered in a cell', () => {
    render(
      <Catch>
        <OrdersTable actions={(order) => <Modal title={`Edit ${order.number}`}>Body</Modal>} />
      </Catch>,
    );

    expectGuardMessage(caughtMessage(), 'Modal');
    expect(screen.queryByRole('dialog')).toBeNull();
    expectOnlyGuardReports();
  });

  it('refuses an Overlay holding an inline Modal rendered in a cell', () => {
    render(
      <Catch>
        <OrdersTable
          actions={(order) => (
            <Overlay>
              <Modal inline title={`Edit ${order.number}`}>
                Body
              </Modal>
            </Overlay>
          )}
        />
      </Catch>,
    );

    expectGuardMessage(caughtMessage(), 'Modal');
    expectOnlyGuardReports();
  });

  it('allows a trigger button and a closed Modal in a cell, because a closed Modal mounts nothing', () => {
    render(
      <OrdersTable
        actions={(order) => (
          <>
            <RowActions>
              <RowAction icon="pencil" label={`Edit ${order.number}`} onClick={() => undefined} />
            </RowActions>
            <Modal open={false} title={`Edit ${order.number}`} />
          </>
        )}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit ORD-2026-0148' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('throws only inside the frame: the hook is silent outside it and loud inside a provider set to true', () => {
    function Probe() {
      useFixedLayerGuard('Probe');
      return <p>ok</p>;
    }
    render(
      <>
        <Probe />
        <Catch>
          <PaintContainmentContext value>
            <Probe />
          </PaintContainmentContext>
        </Catch>
      </>,
    );

    expect(screen.getByText('ok')).toBeInTheDocument();
    expectGuardMessage(caughtMessage(), 'Probe');
    expectOnlyGuardReports();
  });
});

describe('a row action whose dialog state lives on the page (the supported pattern, WR-05)', () => {
  function OrdersPage() {
    const [target, setTarget] = useState<Order | null>(null);
    return (
      <>
        <OrdersTable
          actions={(order) => (
            <RowActions>
              <RowAction
                icon="trash-2"
                label={`Delete ${order.number}`}
                danger
                onClick={() => {
                  setTarget(order);
                }}
              />
            </RowActions>
          )}
        />
        {target !== null && (
          <ConfirmDialog
            title={`Delete ${target.number}?`}
            message="The order and everything recorded on it will be deleted."
            onCancel={() => {
              setTarget(null);
            }}
          />
        )}
      </>
    );
  }

  it('opens the dialog outside the frame, traps focus on Cancel and has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<OrdersPage />);
    await user.click(screen.getByRole('button', { name: 'Delete ORD-2026-0148' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete ORD-2026-0148?' });
    const frame = screen.getByRole('region', { name: CAPTION });
    expect(frame.contains(dialog)).toBe(false);
    expect(dialog.parentElement).not.toBeNull();
    expect(frame.contains(dialog.parentElement)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await expectNoAxeViolations(container);
  });
});
