using System.Data.Common;
using System.Runtime.CompilerServices;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Clears the public cache once a save of a public record is committed (PUB-03, CONT-05): after the save when it owns its transaction,
/// after the commit when the caller opened one. A rollback or a failed save clears nothing, so a cache filled before the commit can
/// never hold data that was not stored. It looks the cache up when it flushes, so a host with no cache registered (a tool) saves as
/// before.
/// </summary>
/// <param name="services">The root provider, used to find <see cref="IPublicContentCache"/> when a flush is due.</param>
internal sealed class PublicContentInvalidationInterceptor(IServiceProvider services) : SaveChangesInterceptor, IDbTransactionInterceptor
{
    private readonly ConditionalWeakTable<DbContext, object> _pending = [];

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        MarkIfPublicRowsChanged(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        MarkIfPublicRowsChanged(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        FlushUnlessInTransaction(eventData.Context);
        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        if (eventData.Context is { Database.CurrentTransaction: null } context && _pending.Remove(context))
        {
            await InvalidateAsync(cancellationToken).ConfigureAwait(false);
        }

        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Forget(eventData?.Context);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Forget(eventData?.Context);
        return Task.CompletedTask;
    }

    public void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData)
    {
        if (eventData?.Context is { } context && _pending.Remove(context))
        {
            InvalidateAsync(CancellationToken.None).AsTask().GetAwaiter().GetResult();
        }
    }

    public async Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        if (eventData?.Context is { } context && _pending.Remove(context))
        {
            await InvalidateAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) => Forget(eventData?.Context);

    public Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        Forget(eventData?.Context);
        return Task.CompletedTask;
    }

    public void TransactionFailed(DbTransaction transaction, TransactionErrorEventData eventData) => Forget(eventData?.Context);

    public Task TransactionFailedAsync(DbTransaction transaction, TransactionErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Forget(eventData?.Context);
        return Task.CompletedTask;
    }

    private void MarkIfPublicRowsChanged(DbContext? context)
    {
        if (context is not null
            && context.ChangeTracker.Entries<IPublicContentRecord>().Any(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            _pending.AddOrUpdate(context, true);
        }
    }

    private void FlushUnlessInTransaction(DbContext? context)
    {
        if (context is { Database.CurrentTransaction: null } && _pending.Remove(context))
        {
            InvalidateAsync(CancellationToken.None).AsTask().GetAwaiter().GetResult();
        }
    }

    private void Forget(DbContext? context)
    {
        if (context is not null)
        {
            _pending.Remove(context);
        }
    }

    private ValueTask InvalidateAsync(CancellationToken cancellationToken) =>
        services.GetService<IPublicContentCache>() is { } cache ? cache.InvalidateAsync(cancellationToken) : ValueTask.CompletedTask;
}
