#if CSPS_TESTING
using System.Security.Cryptography;
using System.Text;
using Csps.Domain.Analytics;
using Csps.Domain.Time;
using Csps.Infrastructure.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>One visit an E2E spec asks for: its source, device, browser and OS labels and how many pages it saw.</summary>
/// <param name="Referrer">The source name, such as Facebook or Direct.</param>
/// <param name="Device">The device class.</param>
/// <param name="Browser">The browser family label.</param>
/// <param name="Os">The OS family label.</param>
/// <param name="PageViews">How many pages the visit saw; at least one.</param>
public sealed record TestingAnalyticsVisit(string Referrer, DeviceKind Device, string Browser, string Os, int PageViews);

/// <summary>One page's figures on one business day, as an E2E spec asks for them.</summary>
/// <param name="Day">The business day.</param>
/// <param name="PageKey">The page key, one of <see cref="PageKeys"/>.</param>
/// <param name="Views">The anonymous page views of the page on the day.</param>
/// <param name="Visits">The visits that landed on the page that day.</param>
public sealed record TestingAnalyticsDay(DateOnly Day, string PageKey, int Views, IReadOnlyList<TestingAnalyticsVisit> Visits);

/// <summary>
/// Puts visitor stats on chosen business days for E2E specs (ANL-08, D-27). Every row already on those days goes first, so a repeat
/// leaves the same facts. Each day gets its daily page counts. A day before the 13-month cut gets the rolled-up source, device and
/// browser counts, as the retention job leaves them; a day from the cut on gets raw visits and their page views instead, with
/// made-up visitor hashes. Debug builds only, and only on the end-to-end or per-test databases.
/// </summary>
/// <param name="context">The database context.</param>
public sealed class TestingAnalyticsSeeder(CspsDbContext context)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    // The seeded visits start at 10:00 business time.
    private static readonly TimeSpan VisitStart = TimeSpan.FromHours(10);

    /// <summary>Gets a value indicating whether the seed may run on the connected database (<see cref="TestingDatabaseGuard"/>).</summary>
    public bool IsDatabaseAllowed => TestingDatabaseGuard.Allows(context);

    /// <summary>Replaces the analytics rows on the given days. It throws on any database the guard refuses.</summary>
    /// <param name="days">The figures; each day and page appears once.</param>
    /// <param name="clock">The business clock, for the cut and the visit times.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the rows are saved.</returns>
    public async Task SeedAsync(IReadOnlyList<TestingAnalyticsDay> days, BusinessClock clock, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(days);
        ArgumentNullException.ThrowIfNull(clock);
        if (!TestingDatabaseGuard.Allows(context))
        {
            throw new InvalidOperationException(TestingDatabaseGuard.Refusal);
        }

        var cut = AnalyticsRetention.RawCut(clock.Today);
        var dates = days.Select(static day => day.Day).Distinct().ToList();

        // One seed at a time, and all or nothing, so parallel specs never meet half a day.
        await Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                // The page views and speed samples of a visit go with it through the cascade.
                await context.AnalyticsVisits.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
                await context.AnalyticsPageViews.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
                await context.DailyPageCounts.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
                await context.DailyReferrerCounts.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
                await context.DailyDeviceCounts.Where(row => dates.Contains(row.BusinessDay)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

                foreach (var day in days)
                {
                    var count = DailyPageCount.First(day.Day, day.PageKey);
                    context.DailyPageCounts.Add(count);
                    context.Entry(count).Property(row => row.Views).CurrentValue = day.Views;
                }

                foreach (var group in days.GroupBy(static day => day.Day))
                {
                    if (group.Key < cut)
                    {
                        AddRolledUp(group.Key, [.. group.SelectMany(static day => day.Visits)]);
                    }
                    else
                    {
                        AddRaw(group.Key, [.. group], clock);
                    }
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

    private void AddRolledUp(DateOnly day, List<TestingAnalyticsVisit> visits)
    {
        foreach (var source in visits.GroupBy(static visit => visit.Referrer, StringComparer.Ordinal))
        {
            context.DailyReferrerCounts.Add(DailyReferrerCount.Of(day, source.Key, source.Count()));
        }

        foreach (var device in visits.GroupBy(static visit => visit.Device))
        {
            context.DailyDeviceCounts.Add(DailyDeviceCount.Of(day, DeviceDimension.Device, device.Key.ToString(), device.Count()));
        }

        foreach (var browser in visits.GroupBy(static visit => visit.Browser, StringComparer.Ordinal))
        {
            context.DailyDeviceCounts.Add(DailyDeviceCount.Of(day, DeviceDimension.Browser, browser.Key, browser.Count()));
        }
    }

    private void AddRaw(DateOnly day, List<TestingAnalyticsDay> pages, BusinessClock clock)
    {
        var startedAt = clock.UtcRange(day, day).StartUtc + VisitStart;
        var index = 0;
        foreach (var page in pages)
        {
            foreach (var spec in page.Visits)
            {
                var visit = AnalyticsVisit.Start(FakeHash(day, index++), day, startedAt, spec.Referrer, spec.Device, spec.Browser, spec.Os, ipHash: null);
                context.AnalyticsVisits.Add(visit);
                var lastSeen = startedAt.AddMinutes(spec.PageViews - 1);
                context.Entry(visit).Property(row => row.PageViews).CurrentValue = spec.PageViews;
                context.Entry(visit).Property(row => row.LastSeenAtUtc).CurrentValue = lastSeen;
                for (var view = 0; view < spec.PageViews; view++)
                {
                    context.AnalyticsPageViews.Add(AnalyticsPageView.Of(visit.Id, day, startedAt.AddMinutes(view), page.PageKey));
                }
            }
        }
    }

    // A made-up visitor hash per seeded visit, so every seeded visit is its own visitor and no real visitor id is ever hashed.
    private static byte[] FakeHash(DateOnly day, int index) =>
        SHA256.HashData(Encoding.UTF8.GetBytes($"csps-e2e-seeded-visitor|{day:yyyy-MM-dd}|{index}"));
}
#endif
