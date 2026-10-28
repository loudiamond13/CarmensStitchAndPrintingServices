using System.Globalization;
using Csps.Application.Common;
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
    public static string DiscountAdded(OrderDiscount discount)
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
