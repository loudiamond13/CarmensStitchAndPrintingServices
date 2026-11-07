using Csps.Application.Dashboard;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Dashboard;

/// <summary>
/// <see cref="IDashboardReader"/> over EF: untracked LINQ aggregates. One grouped read covers the orders, one the payments and one
/// the refunds, each under the named SoftDelete filter of its order, and one reads the caller's first name. Nothing is cached (D-13).
/// </summary>
internal sealed class DashboardReader(CspsDbContext context) : IDashboardReader
{
    // Pending to Delivered and Pending to Ready; listed by name so a count never depends on the enum order.
    private static readonly OrderStatus[] ActiveStatuses = [.. OrderStatusRules.ActiveStatuses];
    private static readonly OrderStatus[] OverdueStatuses = [.. OrderStatusRules.OverdueStatuses];

    public async Task<DashboardFigures> GetSummaryAsync(Guid callerId, DashboardPeriod period, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(period);
        var today = period.Today;
        var monday = period.WeekMonday;
        var sunday = period.WeekSunday;
        var monthFirst = period.MonthFirst;
        var monthLast = period.MonthLast;
        var comparisonFirst = period.ComparisonFirst;
        var comparisonLast = period.ComparisonLast;

        var firstName = await context.Users.AsNoTracking()
            .Where(user => user.Id == callerId)
            .Select(user => user.FirstName)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        // Date columns compare against DateOnly values. A due date that is not set is in neither the week nor the overdue count.
        var orders = await context.Orders.AsNoTracking()
            .GroupBy(static _ => 1)
            .Select(group => new
            {
                Active = group.Count(order => ActiveStatuses.Contains(order.Status)),
                DueThisWeek = group.Count(order => ActiveStatuses.Contains(order.Status)
                    && order.DueDate >= monday
                    && order.DueDate <= sunday
                    && (!OverdueStatuses.Contains(order.Status) || order.DueDate >= today)),
                Overdue = group.Count(order => OverdueStatuses.Contains(order.Status) && order.DueDate < today),
                Receivables = group.Sum(order => ActiveStatuses.Contains(order.Status) && order.Balance > 0m ? order.Balance : 0m),
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        // Money on orders of every status stays in (D-11); a deleted order hides its payments and refunds through its own filter.
        var payments = await context.Set<OrderPayment>().AsNoTracking()
            .Where(payment => payment.PaymentDate >= comparisonFirst && payment.PaymentDate <= monthLast)
            .GroupBy(static _ => 1)
            .Select(group => new
            {
                ThisMonth = group.Sum(payment => payment.PaymentDate >= monthFirst ? payment.Amount : 0m),
                Comparison = group.Sum(payment => payment.PaymentDate <= comparisonLast ? payment.Amount : 0m),
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        var refunds = await context.Set<OrderRefund>().AsNoTracking()
            .Where(refund => refund.RefundDate >= comparisonFirst && refund.RefundDate <= monthLast)
            .GroupBy(static _ => 1)
            .Select(group => new
            {
                ThisMonth = group.Sum(refund => refund.RefundDate >= monthFirst ? refund.Amount : 0m),
                Comparison = group.Sum(refund => refund.RefundDate <= comparisonLast ? refund.Amount : 0m),
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return new DashboardFigures(
            firstName,
            orders?.Active ?? 0,
            orders?.DueThisWeek ?? 0,
            orders?.Overdue ?? 0,
            orders?.Receivables ?? 0m,
            (payments?.ThisMonth ?? 0m) - (refunds?.ThisMonth ?? 0m),
            (payments?.Comparison ?? 0m) - (refunds?.Comparison ?? 0m),
            new DashboardStatusCounts(0, 0, 0, 0, 0, 0));
    }
}
