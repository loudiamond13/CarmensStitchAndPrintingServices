// The Items tab of the order page (ORD-07; UI-SPEC O1 Tab card; plans 08-10, 08-14): a heading and caption over a ResponsiveTable of
// the order's items with a footer of the items subtotal. Every figure is the server's: the line totals as stored, the subtotal from
// the order's totals. Only the piece count is added up here, and it is a count, not money. On an active order the head has Add Item
// and each row has Edit and Delete (never Delete on the last item, D-48); a locked order, and the deleted view (`readOnly`), show
// the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { Note } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderItemModal } from '@/modules/admin/components/OrderItemModal';
import { OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderTabBodyClasses, orderTabNoteClasses } from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canDeleteItem, canEditOrder } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderItemsService } from '@/modules/admin/services/orderItemsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
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

/** The focus registry key of a row's Delete button (the Edit button is registered under the plain id). */
const deleteKey = (id: string): string => `delete:${id}`;

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

/** The dialog's own failure line: the server's sentence for a refusal, and "removed" for an item that is already gone. */
function describeDeleteFailure(error: unknown): ErrorCopy | string | undefined {
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? WINDOWS.deleteGone : undefined;
}

/** An active order: Add Item, and each row's Edit and Delete. */
function EditableItems({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderItemModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ itemId: string; open: boolean } | null>(null);
  // The item the Delete dialog is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ item: OrderItem; n: number; open: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowFocus = useRowFocus();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);
  // Once the answer no longer holds the deleted row, focus goes to the next row's Edit, else the previous one, else the heading.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen && editing?.open !== true && deleting?.open !== true) {
      returnFocus.current = null;
      go();
    }
    const wanted = afterRemoval.current;
    if (wanted !== null && !order.items.some((item) => item.id === wanted.removedId)) {
      afterRemoval.current = null;
      if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
        headingRef.current?.focus();
      }
    }
  });

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useOrderAction<OrderItem>(
    (_key, item) => orderItemsService.remove(order.id, item.id),
    (answer, item) => {
      const index = order.items.findIndex((candidate) => candidate.id === item.id);
      afterRemoval.current = {
        removedId: item.id,
        focusId: order.items[index + 1]?.id ?? order.items[index - 1]?.id ?? null,
      };
      closeDelete();
      toast.show({ tone: 'success', ...orderSavedMessage(answer, 'item', 'deleted') });
      applyOrder(answer);
    },
    (error) => {
      // The page is out of date as well as refused (the item is gone, or it became the last): read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  const columns: readonly ResponsiveTableColumn<OrderItem>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const n = order.items.findIndex((candidate) => candidate.id === item.id) + 1;
        const editName = WINDOWS.editAction(n, item.description);
        const deleteName = WINDOWS.deleteAction(n, item.description);
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
            {canDeleteItem(order) && (
              <RowAction
                icon="trash-2"
                label={deleteName}
                title={deleteName}
                danger
                ref={(button) => {
                  rowFocus.register(deleteKey(item.id), button);
                }}
                onClick={() => {
                  setDeleting({ item, n, open: true });
                }}
              />
            )}
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
      {!canDeleteItem(order) && (
        <div className={orderTabNoteClasses}>
          <Note icon="info">{WINDOWS.lastItemNote}</Note>
        </div>
      )}
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
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={WINDOWS.deleteTitle(deleting.item.description)}
          message={ORDER_WINDOWS_COPY.remove.message(order.number)}
          confirmLabel={WINDOWS.deleteConfirm}
          pendingLabel={ORDER_WINDOWS_COPY.remove.pending}
          cancelLabel={ORDER_WINDOWS_COPY.remove.cancel}
          describeFailure={describeDeleteFailure}
          onConfirm={() => removal.submit(deleting.item)}
          onCancel={() => {
            const itemId = deleting.item.id;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(deleteKey(itemId))) {
                headingRef.current?.focus();
              }
            };
            closeDelete();
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
