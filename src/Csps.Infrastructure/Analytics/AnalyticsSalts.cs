using System.Security.Cryptography;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// <see cref="IAnalyticsSalts"/> over EF (ANL-05, D-07). The first caller of a business day inserts 32 random bytes from the operating system's
/// generator. The day is the primary key, so when two callers race the key refuses the second row and that caller reads the winner's salt back.
/// Recent days are cached in the process. The salt is never logged.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="cache">The process-wide cache.</param>
internal sealed class AnalyticsSalts(CspsDbContext context, AnalyticsSaltCache cache) : IAnalyticsSalts
{
    public async Task<byte[]> ForDayAsync(DateOnly day, CancellationToken cancellationToken)
    {
        if (cache.TryGet(day, out var cached))
        {
            return cached;
        }

        var salt = await ReadAsync(day, cancellationToken).ConfigureAwait(false);
        if (salt is null)
        {
            var row = AnalyticsSalt.Create(day, RandomNumberGenerator.GetBytes(AnalyticsSalt.Length));
            context.AnalyticsSalts.Add(row);
            try
            {
                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                salt = row.Salt;
            }
            catch (DbUpdateException error) when (SqlErrors.Has(error, SqlErrors.UniqueKeyViolation, SqlErrors.DuplicateKey))
            {
                context.Entry(row).State = EntityState.Detached;
                salt = await ReadAsync(day, cancellationToken).ConfigureAwait(false)
                    ?? throw new InvalidOperationException("The salt row of the day was refused as a duplicate but could not be read back.");
            }
        }

        return cache.Set(day, salt);
    }

    private Task<byte[]?> ReadAsync(DateOnly day, CancellationToken cancellationToken) =>
        context.AnalyticsSalts
            .AsNoTracking()
            .Where(row => row.BusinessDay == day)
            .Select(row => row.Salt)
            .FirstOrDefaultAsync(cancellationToken);
}
