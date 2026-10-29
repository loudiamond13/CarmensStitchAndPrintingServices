using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Orders;

/// <summary><see cref="IOrders"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class OrderStore(CspsDbContext context) : IOrders
{
    private const string SoftDeleteFilter = "SoftDelete";
    private const string NumberIndex = "IX_Orders_Number";
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    public void Add(Order order)
    {
        ArgumentNullException.ThrowIfNull(order);
        context.Orders.Add(order);
    }

    public void Remove(Order order)
    {
        ArgumentNullException.ThrowIfNull(order);
        context.Orders.Remove(order);
    }

    public Task<bool> NumberTakenAsync(string number, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(number);
        return context.Orders.IgnoreQueryFilters([SoftDeleteFilter]).AsNoTracking().AnyAsync(order => order.Number == number, cancellationToken);
    }

    /// <summary>
    /// Turns a failed save into the typed exception the Application understands, or returns null when the failure is not the unique
    /// number index: the index found a number another order already holds, so two saves of one number raced.
    /// </summary>
    /// <param name="error">The failed save.</param>
    /// <returns>The typed exception, or null.</returns>
    internal static Exception? TranslateSaveFailure(DbUpdateException error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return error.InnerException is SqlException { Number: UniqueIndexViolation or UniqueConstraintViolation } sql
            && sql.Message.Contains(NumberIndex, StringComparison.Ordinal)
                ? new OrderNumberTakenException()
                : null;
    }

    public async Task<Order?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken)
    {
        var query = includeDeleted
            ? context.Orders.IgnoreQueryFilters([SoftDeleteFilter])
            : context.Orders.AsQueryable();
        var loaded = await query
            .Include(order => order.Items)
            .Include(order => order.Discounts)
            .Include(order => order.Payments)
            .Include(order => order.Expenses)
            .Include(order => order.Refunds)
            .AsSplitQuery()
            .SingleOrDefaultAsync(order => order.Id == id, cancellationToken)
            .ConfigureAwait(false);
        if (loaded is null)
        {
            return null;
        }

        // The split query reads the order row and then each list at a different moment. If the row version moved in between, the
        // lists may belong to a newer save than the row, and a rule such as the payment balance would be judged on a mix. The
        // other request won: this one is told so and reads again.
        var current = await context.Orders.IgnoreQueryFilters([SoftDeleteFilter]).AsNoTracking()
            .Where(row => row.Id == id)
            .Select(row => row.RowVersion)
            .SingleAsync(cancellationToken)
            .ConfigureAwait(false);
        if (!current.AsSpan().SequenceEqual(loaded.RowVersion))
        {
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(new InvalidOperationException("The order was changed while it was being read."));
        }

        return loaded;
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
