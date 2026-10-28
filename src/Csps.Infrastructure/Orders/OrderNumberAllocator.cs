using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Orders;

/// <summary>
/// <see cref="IOrderNumbers"/> over EF (ORD-14, D-23). Every create takes the same lock row first, so the read of the year's
/// counter and its increment cannot race, a new year's first row cannot be inserted twice, and a rollback gives the number back.
/// </summary>
internal sealed class OrderNumberAllocator(CspsDbContext context) : IOrderNumbers
{
    public async Task<string> NextAsync(int year, DateTimeOffset now, CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(context, DatabaseLocks.OrderNumbers, now, DatabaseLocks.DefaultWait, OrderErrors.BusyMessage, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (InvalidOperationException error) when (error.Message == OrderErrors.BusyMessage)
        {
            throw new OrderNumberBusyException();
        }

        var counter = await context.OrderNumberCounters.SingleOrDefaultAsync(row => row.Year == year, cancellationToken).ConfigureAwait(false);
        if (counter is null)
        {
            counter = OrderNumberCounter.Start(year);
            context.OrderNumberCounters.Add(counter);
        }

        // The counter row saves with the order, in the same SaveChanges.
        return OrderNumber.Format(year, counter.Next());
    }
}
