using System.Globalization;
using Csps.Application.Audit;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: a Manager reads unique visitors, visits and page views for a date range (ANL-08, D-24, D-33), with the trend per day for up to
/// 62 days, else per month (<see cref="StatsBucket.For"/>), and the ranked lists with whole-percent shares. Presets are resolved against the business calendar, never the device clock. The
/// read runs on demand with no cache.
/// </summary>
/// <param name="reader">The visitor stats read port.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">Checks the query.</param>
public sealed class GetVisitorStatsHandler(IVisitorStatsReader reader, IBusinessCalendar calendar, IValidator<VisitorStatsRequest> validator)
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string DayBucket = "day";
    private const string MonthBucket = "month";
    private const int ListLength = 10;
    private const int TopBrowsers = 5;

    /// <summary>Reads the totals.</summary>
    /// <param name="request">The query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The totals with the resolved range.</returns>
    public async Task<Result<VisitorStatsResponse>> HandleAsync(VisitorStatsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<VisitorStatsResponse>(
                ValidationResults.ToError(validation, VisitorStatsRequestValidator.InvalidCode, VisitorStatsRequestValidator.InvalidMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var (name, from, to) = Resolve(request, today);
        var cut = AnalyticsRetention.RawCut(today);

        var totals = await reader.ReadTotalsAsync(from, to, cut, cancellationToken).ConfigureAwait(false);
        var bucket = StatsBucket.For(from, to);
        var counts = await reader.ReadTrendAsync(from, to, cut, bucket, cancellationToken).ConfigureAwait(false);
        var lists = await reader.ReadListsAsync(from, to, cut, cancellationToken).ConfigureAwait(false);

        // D-27: visits are kept only from the cut day on. A range wholly before it has no visit figures; one that crosses it counts from the cut.
        var wholeRangeIsOld = to < cut;
        var crossesTheCut = from < cut && !wholeRangeIsOld;
        return Result.Success(new VisitorStatsResponse(
            name,
            Format(from),
            Format(to),
            Format(cut),
            new VisitorTotalsDto(
                wholeRangeIsOld ? null : totals.UniqueVisitors,
                wholeRangeIsOld ? null : totals.Visits,
                totals.PageViews,
                crossesTheCut ? Format(cut) : null),
            bucket == StatsBucketKind.Day ? DayBucket : MonthBucket,
            Fill(from, to, cut, bucket, counts),
            Rank(Order(lists.Pages), ListLength),
            Rank(Order(lists.Referrers), ListLength),
            Rank(Order(lists.Devices), ListLength),
            Rank(FoldBrowsers(lists.Browsers), ListLength),
            new SpeedDto(null, null, null, 0, true)));
    }

    /// <summary>By count, highest first, then by name (ordinal), so equal counts always come in the same order. Zero counts are left out.</summary>
    private static List<NamedCount> Order(IEnumerable<NamedCount> counts) =>
        [.. counts.Where(static row => row.Count > 0)
            .OrderByDescending(static row => row.Count)
            .ThenBy(static row => row.Name, StringComparer.Ordinal)];

    /// <summary>The top browsers in order, then one Other row, last, for the rest and for any browser already stored as Other.</summary>
    private static List<NamedCount> FoldBrowsers(IEnumerable<NamedCount> counts)
    {
        var all = counts.ToList();
        var named = Order(all.Where(static row => !IsOther(row.Name)));
        var other = all.Where(static row => IsOther(row.Name)).Sum(static row => row.Count) + named.Skip(TopBrowsers).Sum(static row => row.Count);
        var rows = named.Take(TopBrowsers).ToList();
        if (other > 0)
        {
            rows.Add(new NamedCount(UserAgentFamily.Other, other));
        }

        return rows;
    }

    private static bool IsOther(string name) => string.Equals(name, UserAgentFamily.Other, StringComparison.Ordinal);

    /// <summary>Whole-percent shares over the full ordered list (<see cref="Shares.LargestRemainder"/>), then the first <paramref name="take"/> rows.</summary>
    private static List<RankedItemDto> Rank(List<NamedCount> ordered, int take)
    {
        var shares = Shares.LargestRemainder([.. ordered.Select(static row => row.Count)]);
        return [.. ordered.Take(take).Select((row, index) => new RankedItemDto(row.Name, (int)Math.Min(row.Count, int.MaxValue), shares[index]))];
    }

    /// <summary>
    /// One bucket per day or month of the range, oldest first: the store's counts where it has data, zeros elsewhere. A month
    /// bucket starts on the range's first day when the range starts mid-month. D-27: a bucket that ends before the cut has no
    /// unique visitors; one that crosses it counts from the cut (the store reads it so).
    /// </summary>
    private static List<TrendBucketDto> Fill(DateOnly from, DateOnly to, DateOnly cut, StatsBucketKind bucket, IReadOnlyList<TrendCount> counts)
    {
        var byStart = counts.ToDictionary(count => count.Start);
        var trend = new List<TrendBucketDto>();
        for (var start = from; start <= to; start = Next(start, bucket))
        {
            var key = bucket == StatsBucketKind.Day ? start : new DateOnly(start.Year, start.Month, 1);
            var monthEnd = Next(start, bucket).AddDays(-1);
            var end = bucket == StatsBucketKind.Day ? start : monthEnd < to ? monthEnd : to;
            var count = byStart.GetValueOrDefault(key);
            int? unique = end < cut ? null : count?.UniqueVisitors ?? 0;
            trend.Add(new TrendBucketDto(Format(start), count?.PageViews ?? 0, unique));
        }

        return trend;
    }

    private static DateOnly Next(DateOnly start, StatsBucketKind bucket) =>
        bucket == StatsBucketKind.Day ? start.AddDays(1) : new DateOnly(start.Year, start.Month, 1).AddMonths(1);

    private static (string Name, DateOnly From, DateOnly To) Resolve(VisitorStatsRequest request, DateOnly today)
    {
        if (request.Range == StatsRangePresets.Custom
            && AuditLogFilters.TryParseDay(request.From, out var from)
            && AuditLogFilters.TryParseDay(request.To, out var to))
        {
            return (StatsRangePresets.Custom, from, to);
        }

        var name = request.Range is { } asked && StatsRangePresets.Names.Contains(asked) ? asked : StatsRangePresets.Default;
        var (start, end) = StatsRangePresets.Resolve(name, today);
        return (name, start, end);
    }

    private static string Format(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
