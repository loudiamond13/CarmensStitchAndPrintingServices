using Csps.Application.Common;
using Csps.Application.Ports;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Persistence;

/// <summary>Commits through the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class CspsUnitOfWork(CspsDbContext context) : IUnitOfWork
{
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
    }

    /// <inheritdoc />
    public async Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(work);

        // An outer transaction owns commit and rollback.
        if (context.Database.CurrentTransaction is not null)
        {
            return await work(cancellationToken).ConfigureAwait(false);
        }

        var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var result = await work(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return result;
        }
    }
}
