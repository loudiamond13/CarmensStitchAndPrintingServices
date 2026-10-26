namespace Csps.Infrastructure.Persistence.Locking;

/// <summary>
/// One row of the DatabaseLocks table (D-50). A standing row is a lock: it is taken by updating the row inside a
/// transaction and held until that transaction ends. A row with an expiry and a holder is an idempotency claim.
/// </summary>
public sealed class DatabaseLock
{
    /// <summary>The longest lock name.</summary>
    public const int NameMaxLength = 80;

    private DatabaseLock()
    {
        Name = string.Empty;
    }

    /// <summary>Gets the lock name, the primary key.</summary>
    public string Name { get; private set; }

    /// <summary>Gets when the lock was last taken; null for a lock never taken.</summary>
    public DateTimeOffset? TakenAtUtc { get; private set; }

    /// <summary>Gets when a claim row stops counting; null for a standing lock.</summary>
    public DateTimeOffset? ExpiresAtUtc { get; private set; }

    /// <summary>Gets who holds a claim row; null for a standing lock.</summary>
    public Guid? HolderId { get; private set; }
}
