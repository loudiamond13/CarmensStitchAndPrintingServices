// The Items tab of the order page (ORD-07; UI-SPEC O1 Tab card; plans 08-10, 08-14): a heading and caption over a ResponsiveTable of
// the order's items with a footer of the items subtotal. Every figure is the server's: the line totals as stored, the subtotal from
// the order's totals. Only the piece count is added up here, and it is a count, not money. On an active order the head has Add Item;
// a locked order, and the deleted view (`readOnly`), show the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderItemModal } from '@/modules/admin/components/OrderItemModal';
import { OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';
import { formatCount } from '@/utils/format';

type OrderItem = OrderDetailResponse['items'][number];

const COPY = ORDER_PAGE_COPY.items;
const WINDOWS = ORDER_WINDOWS_COPY.item;

const COLUMNS: readonly ResponsiveTableColumn<OrderItem>[] = [
  {
    key: 'product',
    header: COPY.columns.product,
    lead: true,
    cell: (item) => <CategoryBadge category={item.productType} />,
  },
  { key: 'description', header: COPY.columns.description, cell: (item) => item.description },
  { key: 'size', header: COPY.columns.size, muted: true, cell: (item) => item.sizeVariant },
  { key: 'quantity', header: COPY.columns.quantity, money: true, cell: (item) => formatCount(Number(item.quantity)) },
  { key: 'unitPrice', header: COPY.columns.unitPrice, money: true, cell: (item) => formatPeso(item.unitPrice) },
  { key: 'lineTotal', header: COPY.columns.lineTotal, money: true, cell: (item) => formatPeso(item.lineTotal) },
];

export interface OrderItemsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

interface ItemsViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderItem>[];
  /** The Add Item button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: a note, then the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function ItemsView({ order, columns, action, headingRef, children }: ItemsViewProps) {
  const pieces = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} action={action} headingRef={headingRef} />
      <div className={orderTabBodyClasses}>
        <ResponsiveTable
          caption={COPY.title}
          columns={columns}
          rows={order.items}
          rowKey={(item) => item.id}
          things={COPY.things}
          footer={{ product: COPY.subtotal(pieces), lineTotal: formatPeso(order.totals.subtotal) }}
          footerLayout={{ product: { span: 5, label: COPY.footerLabel } }}
        />
        {children}
      </div>
    </>
  );
}

/** An active order: Add Item and each row's Edit open the window. */
function EditableItems({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderItemModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ itemId: string; open: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowFocus = useRowFocus();
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen && editing?.open !== true) {
      returnFocus.current = null;
      go();
    }
  });

  const columns: readonly ResponsiveTableColumn<OrderItem>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const n = order.items.findIndex((candidate) => candidate.id === item.id) + 1;
        const editName = WINDOWS.editAction(n, item.description);
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editName}
              title={editName}
              ref={(button) => {
                rowFocus.register(item.id, button);
              }}
              onClick={() => {
                setEditing({ itemId: item.id, open: true });
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <ItemsView
      order={order}
      columns={columns}
      headingRef={headingRef}
      action={
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          ref={addRef}
          onClick={() => {
            setAddUsed(true);
            setAddOpen(true);
          }}
        >
          {WINDOWS.add}
        </Button>
      }
    >
      {addUsed && (
        <OrderItemModal
          mode="add"
          order={order}
          open={addOpen}
          onClose={() => {
            returnFocus.current = () => addRef.current?.focus();
            setAddOpen(false);
          }}
        />
      )}
      {editing !== null && (
        <OrderItemModal
          mode="edit"
          order={order}
          itemId={editing.itemId}
          open={editing.open}
          onClose={() => {
            const itemId = editing.itemId;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(itemId)) {
                headingRef.current?.focus();
              }
            };
            setEditing({ itemId, open: false });
          }}
        />
      )}
    </ItemsView>
  );
}

export function OrderItemsTab({ order, readOnly }: OrderItemsTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <ItemsView order={order} columns={COLUMNS} />;
  }
  return <EditableItems order={order} />;
}
