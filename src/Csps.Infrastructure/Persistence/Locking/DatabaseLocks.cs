using System.Globalization;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Persistence.Locking;

/// <summary>
/// The standing lock rows and the way to take one (D-50). A lock is an <c>ExecuteUpdate</c> on its row inside the
/// caller's transaction. A new lock name is a new standing row added by a migration.
/// </summary>
internal static class DatabaseLocks
{
    /// <summary>The lock that serializes every change to the Manager roster.</summary>
    public const string ActiveManagers = "active-managers";

    /// <summary>The lock that serializes every order number allocation (ORD-14, D-23).</summary>
    public const string OrderNumbers = "order-numbers";

    /// <summary>How many fixed per-person lock rows exist.</summary>
    public const int AccountStripeCount = 64;

    /// <summary>The longest a lock is waited for.</summary>
    public static readonly TimeSpan DefaultWait = TimeSpan.FromSeconds(10);

    private const string AccountPrefix = "account-token:";

    /// <summary>Gets every standing lock name: the roster lock, the order number lock, then the 64 account locks in order.</summary>
    public static IReadOnlyList<string> StandingNames { get; } =
    [
        ActiveManagers,
        OrderNumbers,
        .. Enumerable.Range(0, AccountStripeCount).Select(index => AccountPrefix + index.ToString("D2", CultureInfo.InvariantCulture)),
    ];

    /// <summary>Gives the account lock of a person. The same id always gives the same name, in every process.</summary>
    /// <param name="userId">The person's id.</param>
    /// <returns>One of the 64 account lock names.</returns>
    public static string AccountStripe(Guid userId)
    {
        var digest = SHA256.HashData(userId.ToByteArray());
        return AccountPrefix + (digest[0] % AccountStripeCount).ToString("D2", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Takes a lock inside the caller's open transaction and keeps it to the end of that transaction.
    /// </summary>
    /// <param name="context">The context whose transaction takes the lock.</param>
    /// <param name="name">The standing lock name.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="wait">The longest to wait for the lock, more than zero; rounded up to whole seconds.</param>
    /// <param name="failureMessage">The message of the error when the lock is not had in time or the wait deadlocks.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the lock is held.</returns>
    public static async Task TakeAsync(
        CspsDbContext context, string name, DateTimeOffset now, TimeSpan wait, string failureMessage, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(failureMessage);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(wait, TimeSpan.Zero);

        // A lock taken outside a transaction would end at once and lock nothing.
        if (context.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("A database lock can only be taken inside a transaction.");
        }

        // The timeout is whole seconds and 0 means no limit, so a wait is rounded up to at least one second.
        var previous = context.Database.GetCommandTimeout();
        context.Database.SetCommandTimeout((int)Math.Ceiling(wait.TotalSeconds));
        try
        {
            // The update takes an exclusive row lock that SQL Server holds to the end of the transaction, so a second taker waits.
            // A rollback to an earlier savepoint frees it with the attempt's writes, and the retry takes it again.
            // Every wait stays inside SQL Server, so its deadlock check works.
            var changed = await context.Set<DatabaseLock>()
                .Where(row => row.Name == name)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, now), cancellationToken)
                .ConfigureAwait(false);
            if (changed != 1)
            {
                throw new InvalidOperationException(failureMessage);
            }
        }
        catch (Exception error) when (SqlErrors.Has(error, SqlErrors.Timeout, SqlErrors.DeadlockVictim))
        {
            throw new InvalidOperationException(failureMessage, error);
        }
        finally
        {
            context.Database.SetCommandTimeout(previous);
        }
    }
}
