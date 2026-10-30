// The Discounts tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-15, D-54a; plans 08-12, 08-17): a heading and caption over a
// ResponsiveTable of the discounts (reason, type badge, value, negative amount) with a Total discount footer from the server's figure.
// A row's amount is csps.ts `discountAmount` over the server's subtotal, the same preview the windows use, so the rows add up to the
// footer. On an active order the head has Add Discount and each row has Edit and Delete; a locked order, and the deleted view
// (`readOnly`), show the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { OrderDiscountModal } from '@/modules/admin/components/OrderDiscountModal';
import { OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderCellStrongClasses, orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { ORDER_DISCOUNT_COPY } from '@/modules/admin/orderDiscountCopy';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderDiscountsService } from '@/modules/admin/services/orderDiscountsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { discountAmount, formatPeso, negateMoney } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';

type OrderDiscount = OrderDetailResponse['discounts'][number];

const COPY = ORDER_PAGE_COPY.discounts;
const DISCOUNT = ORDER_DISCOUNT_COPY;

const isPercentage = (discount: OrderDiscount): boolean => discount.kind === 'percentage';

/** "5%" or the peso value; a percentage reads the number as sent ("7.5%"). */
function valueText(discount: OrderDiscount): string {
  return isPercentage(discount) ? `${String(Number(discount.value))}%` : formatPeso(discount.value);
}

/** The focus registry key of a row's Delete button (the Edit button is registered under the plain id). */
const deleteKey = (id: string): string => `delete:${id}`;

export interface OrderDiscountsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

/** The columns every view shows; an editable view adds the actions column after them. */
function dataColumns(subtotal: number): readonly ResponsiveTableColumn<OrderDiscount>[] {
  return [
    {
      key: 'reason',
      header: COPY.columns.reason,
      lead: true,
      cell: (discount) => <strong className={orderCellStrongClasses}>{discount.reason}</strong>,
    },
    {
      key: 'type',
      header: COPY.columns.type,
      cell: (discount) => <Badge tone="neutral">{isPercentage(discount) ? COPY.percentage : COPY.fixed}</Badge>,
    },
    { key: 'value', header: COPY.columns.value, money: true, cell: valueText },
    {
      key: 'amount',
      header: COPY.columns.amount,
      money: true,
      cell: (discount) =>
        formatPeso(
          negateMoney(
            discountAmount(
              { type: isPercentage(discount) ? 'percentage' : 'fixed', value: Number(discount.value) },
              subtotal,
            ),
          ),
        ),
    },
  ];
}

interface DiscountsViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderDiscount>[];
  /** The Add Discount button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function DiscountsView({ order, columns, action, headingRef, children }: DiscountsViewProps) {
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} action={action} headingRef={headingRef} />
      <div className={orderTabBodyClasses}>
        {order.discounts.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={columns}
            rows={order.discounts}
            rowKey={(discount) => discount.id}
            things={COPY.things}
            footer={{ reason: COPY.footerLabel, amount: formatPeso(negateMoney(order.totals.discount)) }}
            footerLayout={{
              reason: { span: columns.filter((column) => column.actions !== true).length - 1 },
              amount: { label: COPY.footerAmountLabel },
            }}
          />
        )}
        {children}
      </div>
    </>
  );
}

/** The dialog's own failure line: the server's sentence for a refusal, and "removed" for a discount that is already gone. */
function describeDeleteFailure(error: unknown): ErrorCopy | string | undefined {
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? DISCOUNT.deleteGone : undefined;
}

/** An active order: Add Discount in the head, and each row's Edit and Delete. */
function EditableDiscounts({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderDiscountModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ discountId: string; open: boolean } | null>(null);
  // The discount the Delete dialog is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ discount: OrderDiscount; open: boolean } | null>(null);
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
    if (wanted !== null && !order.discounts.some((discount) => discount.id === wanted.removedId)) {
      afterRemoval.current = null;
      if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
        headingRef.current?.focus();
      }
    }
  });

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useOrderAction<OrderDiscount>(
    (_key, discount) => orderDiscountsService.remove(order.id, discount.id),
    (answer, discount) => {
      const index = order.discounts.findIndex((candidate) => candidate.id === discount.id);
      afterRemoval.current = {
        removedId: discount.id,
        focusId: order.discounts[index + 1]?.id ?? order.discounts[index - 1]?.id ?? null,
      };
      closeDelete();
      toast.show({ tone: 'success', ...orderSavedMessage(answer, 'discount', 'deleted') });
      applyOrder(answer);
    },
    (error) => {
      // The page is out of date as well as refused (the discount is gone): read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  const columns: readonly ResponsiveTableColumn<OrderDiscount>[] = [
    ...dataColumns(Number(order.totals.subtotal)),
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (discount) => {
        const editName = DISCOUNT.editAction(discount.reason);
        const deleteName = DISCOUNT.deleteAction(discount.reason);
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editName}
              title={editName}
              ref={(button) => {
                rowFocus.register(discount.id, button);
              }}
              onClick={() => {
                setEditing({ discountId: discount.id, open: true });
              }}
            />
            <RowAction
              icon="trash-2"
              label={deleteName}
              title={deleteName}
              danger
              ref={(button) => {
                rowFocus.register(deleteKey(discount.id), button);
              }}
              onClick={() => {
                setDeleting({ discount, open: true });
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <DiscountsView
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
          {DISCOUNT.add}
        </Button>
      }
    >
      {addUsed && (
        <OrderDiscountModal
          mode="add"
          order={order}
          open={addOpen}
          onClose={() => {
            returnFocus.current = () => {
              addRef.current?.focus();
            };
            setAddOpen(false);
          }}
        />
      )}
      {editing !== null && (
        <OrderDiscountModal
          mode="edit"
          order={order}
          discountId={editing.discountId}
          open={editing.open}
          onClose={() => {
            const discountId = editing.discountId;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(discountId)) {
                headingRef.current?.focus();
              }
            };
            setEditing({ discountId, open: false });
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={DISCOUNT.deleteTitle(deleting.discount.reason)}
          message={ORDER_WINDOWS_COPY.remove.message(order.number)}
          confirmLabel={DISCOUNT.deleteConfirm}
          pendingLabel={ORDER_WINDOWS_COPY.remove.pending}
          cancelLabel={ORDER_WINDOWS_COPY.remove.cancel}
          describeFailure={describeDeleteFailure}
          onConfirm={() => removal.submit(deleting.discount)}
          onCancel={() => {
            const discountId = deleting.discount.id;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(deleteKey(discountId))) {
                headingRef.current?.focus();
              }
            };
            closeDelete();
          }}
        />
      )}
    </DiscountsView>
  );
}

export function OrderDiscountsTab({ order, readOnly }: OrderDiscountsTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <DiscountsView order={order} columns={dataColumns(Number(order.totals.subtotal))} />;
  }
  return <EditableDiscounts order={order} />;
}
