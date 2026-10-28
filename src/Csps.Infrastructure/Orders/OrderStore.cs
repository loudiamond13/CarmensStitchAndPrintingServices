using Csps.Application.Common;
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

    public async Task LockAsync(Order order, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(order);

        // The update takes the row's exclusive lock to the end of the transaction. It matches only the row version the order was
        // loaded with, so a request that lost the race changes nothing and is told so before it writes any child row. Any update
        // moves the row version; EditVersion gets a new value so the row really changes.
        var locked = await context.Orders
            .Where(row => row.Id == order.Id && row.RowVersion == order.RowVersion)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.EditVersion, Guid.NewGuid()), cancellationToken)
            .ConfigureAwait(false);
        if (locked != 1)
        {
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(new InvalidOperationException("The order was changed after it was loaded."));
        }

        // The save that follows must match the row version the lock just made.
        var current = await context.Orders.AsNoTracking()
            .Where(row => row.Id == order.Id)
            .Select(row => row.RowVersion)
            .SingleAsync(cancellationToken)
            .ConfigureAwait(false);
        context.Entry(order).Property(row => row.RowVersion).OriginalValue = current;
    }
}
