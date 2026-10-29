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
internal sealed class OrderNumberAllocator : IOrderNumbers
{
    private readonly CspsDbContext _context;
    private readonly TimeSpan _lockWait;

    public OrderNumberAllocator(CspsDbContext context)
        : this(context, DatabaseLocks.DefaultWait)
    {
    }

    // The wait is shortened only by tests; the registered path uses the default.
    internal OrderNumberAllocator(CspsDbContext context, TimeSpan lockWait)
    {
        _context = context;
        _lockWait = lockWait;
    }

    public async Task<string> NextAsync(int year, DateTimeOffset now, CancellationToken cancellationToken)
    {
        await TakeLockAsync(now, cancellationToken).ConfigureAwait(false);

        var counter = await _context.OrderNumberCounters.SingleOrDefaultAsync(row => row.Year == year, cancellationToken).ConfigureAwait(false);
        if (counter is null)
        {
            counter = OrderNumberCounter.Start(year);
            _context.OrderNumberCounters.Add(counter);
        }

        // The counter row saves with the order, in the same SaveChanges.
        return OrderNumber.Format(year, counter.Next());
    }

    public async Task ReserveLegacyAsync(string number, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(number);
        await TakeLockAsync(now, cancellationToken).ConfigureAwait(false);

        // A number that is not ORD-{YYYY}-{NNNN} cannot collide with a given-out number, so every counter stays as it is.
        if (!OrderNumber.TryParse(number, out var year, out var sequence))
        {
            return;
        }

        var counter = await _context.OrderNumberCounters.SingleOrDefaultAsync(row => row.Year == year, cancellationToken).ConfigureAwait(false);
        if (counter is null)
        {
            counter = OrderNumberCounter.Start(year);
            _context.OrderNumberCounters.Add(counter);
        }

        // The counter row saves with the order, in the same SaveChanges.
        counter.EnsureAtLeast(sequence);
    }

    private async Task TakeLockAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(_context, DatabaseLocks.OrderNumbers, now, _lockWait, OrderErrors.BusyMessage, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (InvalidOperationException error) when (error.Message == OrderErrors.BusyMessage)
        {
            throw new OrderNumberBusyException();
        }
    }
}
