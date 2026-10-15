using System.Data.Common;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Infrastructure.Email;

/// <summary>Wakes the dispatcher right after a commit that added outbox rows; the periodic sweep is the safety net.</summary>
internal sealed class OutboxSignal
{
    private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(
        new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    /// <summary>Raises the signal; a signal already waiting absorbs this one.</summary>
    public void Notify() => _channel.Writer.TryWrite(true);

    /// <summary>Waits for the signal or for <paramref name="timeout"/>, whichever comes first.</summary>
    /// <param name="timeout">The longest wait.</param>
    /// <param name="cancellationToken">Stops the wait; the exception propagates.</param>
    /// <returns>A task that completes when the wait ends.</returns>
    public async Task WaitAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        limit.CancelAfter(timeout);
        try
        {
            if (await _channel.Reader.WaitToReadAsync(limit.Token).ConfigureAwait(false))
            {
                _channel.Reader.TryRead(out _);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The sweep interval elapsed.
        }
    }
}

/// <summary>
/// Signals <see cref="OutboxSignal"/> once the rows a save added are committed: after the save when it owns its
/// transaction, after the commit when the caller opened one (a rollback sends nothing).
/// </summary>
/// <param name="signal">The signal to raise.</param>
internal sealed class OutboxSignalInterceptor(OutboxSignal signal) : SaveChangesInterceptor, IDbTransactionInterceptor
{
    private readonly ConditionalWeakTable<DbContext, object> _pending = [];

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        MarkIfOutboxRowsAdded(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        MarkIfOutboxRowsAdded(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        NotifyUnlessInTransaction(eventData.Context);
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        NotifyUnlessInTransaction(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Forget(eventData?.Context);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Forget(eventData?.Context);
        return Task.CompletedTask;
    }

    public void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData) => NotifyIfPending(eventData?.Context);

    public Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        NotifyIfPending(eventData?.Context);
        return Task.CompletedTask;
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

    private void MarkIfOutboxRowsAdded(DbContext? context)
    {
        if (context is not null && context.ChangeTracker.Entries<EmailOutboxMessage>().Any(entry => entry.State == EntityState.Added))
        {
            _pending.AddOrUpdate(context, true);
        }
    }

    private void NotifyUnlessInTransaction(DbContext? context)
    {
        if (context is not null && context.Database.CurrentTransaction is null)
        {
            NotifyIfPending(context);
        }
    }

    private void NotifyIfPending(DbContext? context)
    {
        if (context is not null && _pending.Remove(context))
        {
            signal.Notify();
        }
    }

    private void Forget(DbContext? context)
    {
        if (context is not null)
        {
            _pending.Remove(context);
        }
    }
}
