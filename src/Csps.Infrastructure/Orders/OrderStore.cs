using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Orders;

/// <summary><see cref="IOrders"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class OrderStore(CspsDbContext context) : IOrders
{
    private const string SoftDeleteFilter = "SoftDelete";

    public void Add(Order order)
    {
        ArgumentNullException.ThrowIfNull(order);
        context.Orders.Add(order);
    }

    public async Task<Order?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken)
    {
        var query = includeDeleted
            ? context.Orders.IgnoreQueryFilters([SoftDeleteFilter])
            : context.Orders.AsQueryable();
        return await query
            .Include(order => order.Items)
            .AsSplitQuery()
            .SingleOrDefaultAsync(order => order.Id == id, cancellationToken)
            .ConfigureAwait(false);
    }
}
