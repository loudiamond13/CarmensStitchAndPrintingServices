using Csps.Application.Dashboard;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Dashboard;

/// <summary>
/// <see cref="IDashboardReader"/> over EF: untracked LINQ aggregates, one grouped read of the orders under the named SoftDelete
/// filter and one for the caller's first name. Nothing is cached (D-13).
/// </summary>
internal sealed class DashboardReader(CspsDbContext context) : IDashboardReader
{
    // Pending to Delivered; listed by name so the count never depends on the enum order.
    private static readonly OrderStatus[] ActiveStatuses = [.. OrderStatusRules.ActiveStatuses];

    public async Task<DashboardFigures> GetSummaryAsync(Guid callerId, DashboardPeriod period, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(period);

        var firstName = await context.Users.AsNoTracking()
            .Where(user => user.Id == callerId)
            .Select(user => user.FirstName)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        var counts = await context.Orders.AsNoTracking()
            .GroupBy(static _ => 1)
            .Select(group => new { Active = group.Count(order => ActiveStatuses.Contains(order.Status)) })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return new DashboardFigures(firstName, counts?.Active ?? 0);
    }
}
