#if CSPS_TESTING
using Csps.Domain.Analytics;
using Csps.Infrastructure.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>One page's figures on one business day, as an E2E spec asks for them.</summary>
/// <param name="Day">The business day.</param>
/// <param name="PageKey">The page key, one of <see cref="PageKeys"/>.</param>
/// <param name="Views">The anonymous page views of the page on the day.</param>
public sealed record TestingAnalyticsDay(DateOnly Day, string PageKey, int Views);

/// <summary>
/// Puts page views on chosen business days for E2E specs (ANL-08, D-57). The daily page counts already on those days go first, so a
/// repeat leaves the same facts. Only daily page counts are written. Debug builds only, and only on the end-to-end or per-test databases.
/// </summary>
/// <param name="context">The database context.</param>
public sealed class TestingAnalyticsSeeder(CspsDbContext context)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    /// <summary>Gets a value indicating whether the seed may run on the connected database (<see cref="TestingDatabaseGuard"/>).</summary>
    public bool IsDatabaseAllowed => TestingDatabaseGuard.Allows(context);

    /// <summary>Replaces the daily page counts on the given days. It throws on any database the guard refuses.</summary>
    /// <param name="days">The figures; each day and page appears once.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the rows are saved.</returns>
    public async Task SeedAsync(IReadOnlyList<TestingAnalyticsDay> days, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(days);
        if (!TestingDatabaseGuard.Allows(context))
        {
            throw new InvalidOperationException(TestingDatabaseGuard.Refusal);
        }

        var dates = days.Select(static day => day.Day).Distinct().ToList();

        // One seed at a time, and all or nothing, so parallel specs never meet half a day.
        await Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                await context.DailyPageCounts.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

                foreach (var day in days)
                {
                    var count = DailyPageCount.First(day.Day, day.PageKey);
                    context.DailyPageCounts.Add(count);
                    context.Entry(count).Property(row => row.Views).CurrentValue = day.Views;
                }

                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            context.ChangeTracker.Clear();
            Gate.Release();
        }
    }
}
#endif
