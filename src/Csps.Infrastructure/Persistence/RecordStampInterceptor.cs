using Csps.Application.Ports;
using Csps.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The one place that sets who and when for every <see cref="IAttributedRecord"/> (SEC-08), from the signed-in user and
/// the clock. A new record gets Created*; a changed one gets Updated*. A record that is also <see cref="IEditVersioned"/>
/// is stamped only when its edit version changed, so Identity bookkeeping (failed-password count, rehash, security stamp)
/// never counts as a staff edit. Stateless apart from its two singleton services, so one instance serves every context.
/// </summary>
/// <param name="actor">The signed-in user, read on every save.</param>
/// <param name="time">The clock.</param>
internal sealed class RecordStampInterceptor(ICurrentActor actor, TimeProvider time) : SaveChangesInterceptor
{
    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        Stamp(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        Stamp(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    // Entries<T>() runs change detection first, so a property changed on a tracked entry is seen here.
    private void Stamp(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var actorId = actor.UserId;
        var now = time.GetUtcNow().ToUniversalTime();
        foreach (var entry in context.ChangeTracker.Entries<IAttributedRecord>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Property(nameof(IAttributedRecord.CreatedById)).CurrentValue = actorId;
                    entry.Property(nameof(IAttributedRecord.CreatedAtUtc)).CurrentValue = now;
                    break;
                case EntityState.Modified when IsStaffEdit(entry):
                    StampUpdated(entry, actorId, now);
                    break;
                default:
                    break;
            }
        }
    }

    // Compare values, never IsModified: UserStore.UpdateAsync calls Context.Update, which marks every property modified.
    private static bool IsStaffEdit(EntityEntry entry)
    {
        if (entry.Entity is not IEditVersioned)
        {
            return true;
        }

        var version = entry.Property(nameof(IEditVersioned.EditVersion));
        return !Equals(version.OriginalValue, version.CurrentValue);
    }

    private static void StampUpdated(EntityEntry entry, Guid? actorId, DateTimeOffset now)
    {
        var updatedBy = entry.Property(nameof(IAttributedRecord.UpdatedById));

        // With no signed-in user (an anonymous link flow), keep an id that server code set in this same save.
        // Request bodies never reach entity properties, so this opens no spoofing path.
        if (actorId is not null || Equals(updatedBy.OriginalValue, updatedBy.CurrentValue))
        {
            updatedBy.CurrentValue = actorId;
        }

        entry.Property(nameof(IAttributedRecord.UpdatedAtUtc)).CurrentValue = now;
    }
}
