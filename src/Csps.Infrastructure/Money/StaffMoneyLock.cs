using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Money;

/// <summary>
/// <see cref="IStaffMoneyLock"/> over the request's scoped <see cref="CspsDbContext"/> (MONEY-05, D-53). The lock is the update of the
/// standing <c>staff-money</c> row, so it needs no trigger (OR-7) and no inline SQL (D-50).
/// </summary>
internal sealed partial class StaffMoneyLock : IStaffMoneyLock
{
    private readonly CspsDbContext _context;
    private readonly TimeProvider _time;
    private readonly ILogger<StaffMoneyLock> _logger;
    private readonly TimeSpan _wait;

    public StaffMoneyLock(CspsDbContext context, TimeProvider time, ILogger<StaffMoneyLock> logger)
        : this(context, time, logger, DatabaseLocks.DefaultWait)
    {
    }

    // The wait is shortened only by tests; the registered path uses the default.
    internal StaffMoneyLock(CspsDbContext context, TimeProvider time, ILogger<StaffMoneyLock> logger, TimeSpan wait)
    {
        _context = context;
        _time = time;
        _logger = logger;
        _wait = wait;
    }

    public async Task LockAsync(CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(
                    _context,
                    DatabaseLocks.StaffMoney,
                    _time.GetUtcNow(),
                    _wait,
                    MoneyErrors.BusyMessage,
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
        {
            // A lost deadlock is a lost race, as in a save: the unit of work marks an outer transaction ended, or the caller retries.
            _context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(error);
        }
        catch (DatabaseLockTimeoutException error)
        {
            LogBusy(_logger, error, DatabaseLocks.StaffMoney, (int)Math.Ceiling(_wait.TotalSeconds));
            throw new StaffMoneyBusyException(error);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The lock {LockName} was not had within {WaitSeconds} seconds; the transfer answers busy.")]
    private static partial void LogBusy(ILogger logger, Exception exception, string lockName, int waitSeconds);
}
