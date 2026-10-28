using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>
/// The detail text of the order audit entries (D-31). It names ids, numbers, dates, counts and amounts, never customer details
/// or notes (05 D-40), and stays under the audit log's detail limit. The keys are documented in docs/operations/audit-log.md.
/// </summary>
public static class OrderAuditDetail
{
    /// <summary>The detail of <c>order.created</c>: number, status, dates, item count and total.</summary>
    /// <param name="order">The new order, numbered and checked.</param>
    /// <returns>For example <c>number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=2026-11-11;items=1;total=9750.00</c>.</returns>
    public static string Created(Order order)
    {
        ArgumentNullException.ThrowIfNull(order);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("number", order.Number),
            AuditDetailFormat.Pair("status", OrderStatusNames.ToKey(order.Status)),
            AuditDetailFormat.Pair("orderDate", order.OrderDate),
            order.DueDate is { } due ? AuditDetailFormat.Pair("dueDate", due) : AuditDetailFormat.Pair("dueDate", string.Empty),
            AuditDetailFormat.Pair("items", order.Items.Count.ToString(CultureInfo.InvariantCulture)),
            AuditDetailFormat.Pair("total", order.Total));
    }

    /// <summary>
    /// The detail of <c>order.changed</c>: <c>orderDate=old&gt;new</c> and <c>dueDate=old&gt;new</c> for the dates that changed (the old
    /// due date is empty for an imported order that had none), then <c>fields=</c> naming the customer details and notes that
    /// changed. Their text never goes in.
    /// </summary>
    /// <param name="changes">What the edit changed.</param>
    /// <returns>For example <c>dueDate=2026-11-11&gt;2026-11-18;fields=customerName,notes</c>.</returns>
    public static string DetailsChanged(OrderDetailsChanges changes)
    {
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>();
        if (changes.OrderDate is { } orderDate)
        {
            parts.Add(AuditDetailFormat.Change("orderDate", orderDate.From, orderDate.To));
        }

        if (changes.DueDate is { } dueDate)
        {
            parts.Add(dueDate.From is { } from
                ? AuditDetailFormat.Change("dueDate", from, dueDate.To)
                : AuditDetailFormat.Change("dueDate", string.Empty, dueDate.To.ToString(OrderRules.DateFormat, CultureInfo.InvariantCulture)));
        }

        if (changes.ChangedFields.Count > 0)
        {
            parts.Add(AuditDetailFormat.Pair("fields", string.Join(',', changes.ChangedFields)));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>The detail of <c>order-item.added</c>: the item id, product type, quantity and unit price, never the description or size.</summary>
    /// <param name="item">The item that was added.</param>
    /// <returns>For example <c>item=&lt;id&gt;;productType=&lt;id&gt;;quantity=2;unitPrice=550.00</c>.</returns>
    public static string ItemAdded(OrderItem item) => ItemSnapshot(item);

    /// <summary>The detail of <c>order-item.removed</c>: the item id, product type, quantity and unit price as they were.</summary>
    /// <param name="item">The item that was removed.</param>
    /// <returns>For example <c>item=&lt;id&gt;;productType=&lt;id&gt;;quantity=2;unitPrice=550.00</c>.</returns>
    public static string ItemRemoved(OrderItem item) => ItemSnapshot(item);

    /// <summary>
    /// The detail of <c>order-item.changed</c>: the item id, then <c>productType</c>, <c>quantity</c> and <c>unitPrice</c> as
    /// <c>old&gt;new</c> where they changed and as the current value where they did not, then <c>fields=</c> naming the text fields
    /// that changed (<c>description</c>, <c>sizeVariant</c>). Their text never goes in.
    /// </summary>
    /// <param name="item">The item after the change.</param>
    /// <param name="changes">What the edit changed.</param>
    /// <returns>For example <c>item=&lt;id&gt;;productType=&lt;id&gt;;quantity=15&gt;20;unitPrice=650.00;fields=description</c>.</returns>
    public static string ItemChanged(OrderItem item, OrderItemChanges changes)
    {
        ArgumentNullException.ThrowIfNull(item);
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>
        {
            AuditDetailFormat.Pair("item", item.Id),
            changes.ProductType is { } type ? AuditDetailFormat.Change("productType", type.From, type.To) : AuditDetailFormat.Pair("productType", item.ProductTypeId),
            changes.Quantity is { } quantity
                ? AuditDetailFormat.Change("quantity", quantity.From.ToString(CultureInfo.InvariantCulture), quantity.To.ToString(CultureInfo.InvariantCulture))
                : AuditDetailFormat.Pair("quantity", item.Quantity.ToString(CultureInfo.InvariantCulture)),
            changes.UnitPrice is { } price ? AuditDetailFormat.Change("unitPrice", price.From, price.To) : AuditDetailFormat.Pair("unitPrice", item.UnitPrice),
        };
        if (changes.ChangedFields.Count > 0)
        {
            parts.Add(AuditDetailFormat.Pair("fields", string.Join(',', changes.ChangedFields)));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>The detail of <c>order-discount.added</c>: the discount id, kind and value, never the reason.</summary>
    /// <param name="discount">The discount that was added.</param>
    /// <returns>For example <c>discount=&lt;id&gt;;kind=percentage;value=5.00</c>.</returns>
    public static string DiscountAdded(OrderDiscount discount) => DiscountSnapshot(discount);

    /// <summary>The detail of <c>order-discount.removed</c>: the discount id, kind and value as they were, never the reason.</summary>
    /// <param name="discount">The discount that was removed.</param>
    /// <returns>For example <c>discount=&lt;id&gt;;kind=percentage;value=5.00</c>.</returns>
    public static string DiscountRemoved(OrderDiscount discount) => DiscountSnapshot(discount);

    /// <summary>
    /// The detail of <c>order-discount.changed</c>: the discount id, then <c>kind</c> and <c>value</c> as <c>old&gt;new</c> where they
    /// changed and as the current value where they did not, then <c>fields=reason</c> when the reason changed. The reason text never
    /// goes in.
    /// </summary>
    /// <param name="discount">The discount after the change.</param>
    /// <param name="changes">What the edit changed.</param>
    /// <returns>For example <c>discount=&lt;id&gt;;kind=percentage;value=5.00&gt;10.00;fields=reason</c>.</returns>
    public static string DiscountChanged(OrderDiscount discount, OrderDiscountChanges changes)
    {
        ArgumentNullException.ThrowIfNull(discount);
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>
        {
            AuditDetailFormat.Pair("discount", discount.Id),
            changes.Kind is { } kind
                ? AuditDetailFormat.Change("kind", DiscountKindNames.ToKey(kind.From), DiscountKindNames.ToKey(kind.To))
                : AuditDetailFormat.Pair("kind", DiscountKindNames.ToKey(discount.Kind)),
            changes.Value is { } value ? AuditDetailFormat.Change("value", value.From, value.To) : AuditDetailFormat.Pair("value", discount.Value),
        };
        if (changes.ReasonChanged)
        {
            parts.Add(AuditDetailFormat.Pair("fields", "reason"));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>The detail of <c>order-payment.added</c>: the payment id, date, amount, method and receiver, never the reference or notes.</summary>
    /// <param name="payment">The payment that was added.</param>
    /// <returns>For example <c>payment=&lt;id&gt;;date=2026-10-25;amount=10000.00;method=&lt;id&gt;;receiver=&lt;id&gt;</c>.</returns>
    public static string PaymentAdded(OrderPayment payment) => PaymentSnapshot(payment);

    /// <summary>The detail of <c>order-payment.removed</c>: the payment id, date, amount, method and receiver as they were, never the reference or notes.</summary>
    /// <param name="payment">The payment that was removed.</param>
    /// <returns>For example <c>payment=&lt;id&gt;;date=2026-10-25;amount=10000.00;method=&lt;id&gt;;receiver=&lt;id&gt;</c>.</returns>
    public static string PaymentRemoved(OrderPayment payment) => PaymentSnapshot(payment);

    /// <summary>
    /// The detail of <c>order-payment.changed</c>: the payment id, then <c>date</c>, <c>amount</c> and <c>method</c> as
    /// <c>old&gt;new</c> where they changed and as the current value where they did not, then the receiver as it now is, then
    /// <c>fields=</c> naming the text fields that changed (<c>reference</c>, <c>notes</c>). Their text never goes in. A new
    /// receiver also has its own <c>order-payment.receiver-changed</c> entry.
    /// </summary>
    /// <param name="payment">The payment after the change.</param>
    /// <param name="changes">What the edit changed.</param>
    /// <returns>For example <c>payment=&lt;id&gt;;date=2026-10-25;amount=10000.00&gt;9000.00;method=&lt;id&gt;;receiver=&lt;id&gt;;fields=notes</c>.</returns>
    public static string PaymentChanged(OrderPayment payment, OrderPaymentChanges changes)
    {
        ArgumentNullException.ThrowIfNull(payment);
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>
        {
            AuditDetailFormat.Pair("payment", payment.Id),
            changes.Date is { } date ? AuditDetailFormat.Change("date", date.From, date.To) : AuditDetailFormat.Pair("date", payment.PaymentDate),
            changes.Amount is { } amount ? AuditDetailFormat.Change("amount", amount.From, amount.To) : AuditDetailFormat.Pair("amount", payment.Amount),
            changes.Method is { } method ? AuditDetailFormat.Change("method", method.From, method.To) : AuditDetailFormat.Pair("method", payment.PaymentMethodId),
            AuditDetailFormat.Pair("receiver", payment.ReceivedByUserId),
        };
        if (changes.ChangedFields.Count > 0)
        {
            parts.Add(AuditDetailFormat.Pair("fields", string.Join(',', changes.ChangedFields)));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>The detail of <c>order-payment.receiver-changed</c>: the payment id and the receiver as <c>old&gt;new</c>.</summary>
    /// <param name="payment">The payment after the change.</param>
    /// <param name="receiver">The receiver change.</param>
    /// <returns>For example <c>payment=&lt;id&gt;;receiver=&lt;old id&gt;&gt;&lt;new id&gt;</c>.</returns>
    public static string PaymentReceiverChanged(OrderPayment payment, ValueChange<Guid> receiver)
    {
        ArgumentNullException.ThrowIfNull(payment);
        ArgumentNullException.ThrowIfNull(receiver);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("payment", payment.Id),
            AuditDetailFormat.Change("receiver", receiver.From, receiver.To));
    }

    /// <summary>The detail of <c>order-refund.added</c>: the refund id, date, amount and refunder, never the reason.</summary>
    /// <param name="refund">The refund that was added.</param>
    /// <returns>For example <c>refund=&lt;id&gt;;date=2026-10-28;amount=12000.00;refunder=&lt;id&gt;</c>.</returns>
    public static string RefundAdded(OrderRefund refund) => RefundSnapshot(refund);

    /// <summary>The detail of <c>order-expense.added</c>:the expense id, date, amount, category and payer, never the description.</summary>
    /// <param name="expense">The expense that was added.</param>
    /// <returns>For example <c>expense=&lt;id&gt;;date=2026-10-23;amount=3825.00;category=&lt;id&gt;;payer=&lt;id&gt;</c>.</returns>
    public static string ExpenseAdded(OrderExpense expense) => ExpenseSnapshot(expense);

    /// <summary>The detail of <c>order-expense.removed</c>: the expense id, date, amount, category and payer as they were, never the description.</summary>
    /// <param name="expense">The expense that was removed.</param>
    /// <returns>For example <c>expense=&lt;id&gt;;date=2026-10-23;amount=3825.00;category=&lt;id&gt;;payer=&lt;id&gt;</c>.</returns>
    public static string ExpenseRemoved(OrderExpense expense) => ExpenseSnapshot(expense);

    /// <summary>
    /// The detail of <c>order-expense.changed</c>: the expense id, then <c>date</c>, <c>amount</c> and <c>category</c> as
    /// <c>old&gt;new</c> where they changed and as the current value where they did not, then the payer as it now is, then
    /// <c>fields=description</c> when the description changed. Its text never goes in. A new payer also has its own
    /// <c>order-expense.payer-changed</c> entry.
    /// </summary>
    /// <param name="expense">The expense after the change.</param>
    /// <param name="changes">What the edit changed.</param>
    /// <returns>For example <c>expense=&lt;id&gt;;date=2026-10-23;amount=3825.00&gt;3000.00;category=&lt;id&gt;;payer=&lt;id&gt;;fields=description</c>.</returns>
    public static string ExpenseChanged(OrderExpense expense, OrderExpenseChanges changes)
    {
        ArgumentNullException.ThrowIfNull(expense);
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>
        {
            AuditDetailFormat.Pair("expense", expense.Id),
            changes.Date is { } date ? AuditDetailFormat.Change("date", date.From, date.To) : AuditDetailFormat.Pair("date", expense.ExpenseDate),
            changes.Amount is { } amount ? AuditDetailFormat.Change("amount", amount.From, amount.To) : AuditDetailFormat.Pair("amount", expense.Amount),
            changes.Category is { } category ? AuditDetailFormat.Change("category", category.From, category.To) : AuditDetailFormat.Pair("category", expense.OrderExpenseCategoryId),
            AuditDetailFormat.Pair("payer", expense.PaidByUserId),
        };
        if (changes.ChangedFields.Count > 0)
        {
            parts.Add(AuditDetailFormat.Pair("fields", string.Join(',', changes.ChangedFields)));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>The detail of <c>order-expense.payer-changed</c>: the expense id and the payer as <c>old&gt;new</c>.</summary>
    /// <param name="expense">The expense after the change.</param>
    /// <param name="payer">The payer change.</param>
    /// <returns>For example <c>expense=&lt;id&gt;;payer=&lt;old id&gt;&gt;&lt;new id&gt;</c>.</returns>
    public static string ExpensePayerChanged(OrderExpense expense, ValueChange<Guid> payer)
    {
        ArgumentNullException.ThrowIfNull(expense);
        ArgumentNullException.ThrowIfNull(payer);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("expense", expense.Id),
            AuditDetailFormat.Change("payer", payer.From, payer.To));
    }

    /// <summary>The detail of <c>order.status-changed</c> and <c>order.reopened</c>: the status as <c>from&gt;to</c>, by wire key.</summary>
    /// <param name="from">The status the order left.</param>
    /// <param name="to">The status it entered.</param>
    /// <returns>For example <c>status=pending&gt;mockup</c>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">A status is not one of the seven.</exception>
    public static string StatusChanged(OrderStatus from, OrderStatus to) =>
        AuditDetailFormat.Change("status", OrderStatusNames.ToKey(from), OrderStatusNames.ToKey(to));

    private static string RefundSnapshot(OrderRefund refund)
    {
        ArgumentNullException.ThrowIfNull(refund);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("refund", refund.Id),
            AuditDetailFormat.Pair("date", refund.RefundDate),
            AuditDetailFormat.Pair("amount", refund.Amount),
            AuditDetailFormat.Pair("refunder", refund.RefundedByUserId));
    }

    private static string ExpenseSnapshot(OrderExpense expense)
    {
        ArgumentNullException.ThrowIfNull(expense);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("expense", expense.Id),
            AuditDetailFormat.Pair("date", expense.ExpenseDate),
            AuditDetailFormat.Pair("amount", expense.Amount),
            AuditDetailFormat.Pair("category", expense.OrderExpenseCategoryId),
            AuditDetailFormat.Pair("payer", expense.PaidByUserId));
    }

    private static string PaymentSnapshot(OrderPayment payment)
    {
        ArgumentNullException.ThrowIfNull(payment);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("payment", payment.Id),
            AuditDetailFormat.Pair("date", payment.PaymentDate),
            AuditDetailFormat.Pair("amount", payment.Amount),
            AuditDetailFormat.Pair("method", payment.PaymentMethodId),
            AuditDetailFormat.Pair("receiver", payment.ReceivedByUserId));
    }

    private static string DiscountSnapshot(OrderDiscount discount)
    {
        ArgumentNullException.ThrowIfNull(discount);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("discount", discount.Id),
            AuditDetailFormat.Pair("kind", DiscountKindNames.ToKey(discount.Kind)),
            AuditDetailFormat.Pair("value", discount.Value));
    }

    private static string ItemSnapshot(OrderItem item)
    {
        ArgumentNullException.ThrowIfNull(item);

        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("item", item.Id),
            AuditDetailFormat.Pair("productType", item.ProductTypeId),
            AuditDetailFormat.Pair("quantity", item.Quantity.ToString(CultureInfo.InvariantCulture)),
            AuditDetailFormat.Pair("unitPrice", item.UnitPrice));
    }
}
