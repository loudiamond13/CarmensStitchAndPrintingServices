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
}
