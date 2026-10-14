using Csps.Domain.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Infrastructure.Auditing;

/// <summary>
/// Defense in depth for the append-only audit log (FND-10, D-25): refuses to save a changed or removed
/// <see cref="AuditEntry"/> before any SQL is sent, with a clear message instead of the trigger's SQL error 51000 or
/// 51001. The database trigger stays the real guarantee; this only catches application bugs early. Stateless, so one
/// shared instance serves every context.
/// </summary>
internal sealed class AuditLogAppendOnlyInterceptor : SaveChangesInterceptor
{
    /// <summary>The message of the exception thrown for a modified or deleted audit entry.</summary>
    public const string Message = "AuditLog is append-only: modifying or deleting audit entries is not allowed.";

    /// <summary>The shared instance registered on every context.</summary>
    public static AuditLogAppendOnlyInterceptor Instance { get; } = new();

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        EnsureAppendOnly(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        EnsureAppendOnly(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    // Entries<T>() runs change detection first, so a property changed on a tracked entry is seen here.
    private static void EnsureAppendOnly(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        foreach (var entry in context.ChangeTracker.Entries<AuditEntry>())
        {
            if (entry.State is EntityState.Modified or EntityState.Deleted)
            {
                throw new InvalidOperationException(Message);
            }
        }
    }
}
