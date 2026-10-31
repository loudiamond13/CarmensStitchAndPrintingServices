using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.OrderLists;
using Csps.Infrastructure.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Csps.Infrastructure.Persistence;

/// <summary>Commits through the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class CspsUnitOfWork(CspsDbContext context) : IUnitOfWork
{
    private int _savepoints;

    /// <inheritdoc />
    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            // Application cannot see EF. The stale entities go, so the caller can load the rows again.
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(exception);
        }
        catch (DbUpdateException exception)
        {
            // A category, order list or order number constraint (unique name, a row still using the entry, or a number another order
            // holds) becomes a typed error the handler maps. The failed row leaves the context, or the next save on this request would try it again.
            var translated = ExpenseCategoryStore.TranslateSaveFailure(exception)
                ?? OrderListStore.TranslateSaveFailure(exception)
                ?? OrderStore.TranslateSaveFailure(exception);
            if (translated is null && !IsDeadlockVictim(exception))
            {
                throw;
            }

            context.ChangeTracker.Clear();
            throw translated ?? new ConcurrencyConflictException(exception);
        }
        catch (InvalidOperationException exception) when (IsDeadlockVictim(exception))
        {
            // EF wraps a deadlock victim, which SQL Server calls transient, in an InvalidOperationException. It is a lost race: the
            // server already rolled the transaction back, so the caller may read the rows again and decide afresh.
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(exception);
        }
    }

    /// <inheritdoc />
    public async Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(work);

        // An outer transaction owns commit and rollback; each attempt gets its own savepoint so a retry starts clean.
        if (context.Database.CurrentTransaction is { } outer)
        {
            return await RunInSavepointAsync(outer, work, cancellationToken).ConfigureAwait(false);
        }

        var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var result = await work(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return result;
        }
    }

    private async Task<T> RunInSavepointAsync<T>(IDbContextTransaction outer, Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        var savepoint = $"csps_attempt_{++_savepoints}";
        await outer.CreateSavepointAsync(savepoint, cancellationToken).ConfigureAwait(false);

        T result;
        try
        {
            result = await work(cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException conflict) when (IsDeadlockVictim(conflict))
        {
            // The server rolled the whole transaction back, so no savepoint is left to go back to. The caller answers the lost race
            // and the gate ends its lease.
            throw new ConcurrencyConflictException(conflict.InnerException ?? conflict, outerTransactionEnded: true);
        }
        catch
        {
            // A failed rollback replaces the original error, so no retry runs on a transaction in an unknown state.
            await outer.RollbackToSavepointAsync(savepoint, CancellationToken.None).ConfigureAwait(false);
            throw;
        }

        await outer.ReleaseSavepointAsync(savepoint, cancellationToken).ConfigureAwait(false);
        return result;
    }

    private static bool IsDeadlockVictim(Exception error) => SqlErrors.Has(error, SqlErrors.DeadlockVictim);
}
