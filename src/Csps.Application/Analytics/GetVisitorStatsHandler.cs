using System.Globalization;
using Csps.Application.Audit;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: a Manager reads the page views of a date range, the five most viewed pages with whole-percent shares of all views, and the trend
/// per day for up to 62 days, else per month (<see cref="StatsBucket.For"/>) (ANL-08, D-24, D-57, D-67, D-68). Everything comes from the daily
/// page counts. Presets are resolved against the business calendar, never the device clock. The read runs on demand with no cache.
/// </summary>
/// <param name="reader">The visitor stats read port.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">Checks the query.</param>
public sealed class GetVisitorStatsHandler(IVisitorStatsReader reader, IBusinessCalendar calendar, IValidator<VisitorStatsRequest> validator)
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string DayBucket = "day";
    private const string MonthBucket = "month";
    private const int ListLength = 5;

    /// <summary>Reads the page views, the trend and the top pages.</summary>
    /// <param name="request">The query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The figures with the resolved range.</returns>
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
        var (name, from, to) = Resolve(request, clock.Today);

        var pageViews = await reader.ReadPageViewsAsync(from, to, cancellationToken).ConfigureAwait(false);
        var bucket = StatsBucket.For(from, to);
        var counts = await reader.ReadTrendAsync(from, to, bucket, cancellationToken).ConfigureAwait(false);
        var pages = await reader.ReadPagesAsync(from, to, cancellationToken).ConfigureAwait(false);

        return Result.Success(new VisitorStatsResponse(
            name,
            Format(from),
            Format(to),
            pageViews,
            bucket == StatsBucketKind.Day ? DayBucket : MonthBucket,
            Fill(from, to, bucket, counts),
            Rank(Order(pages), ListLength)));
    }

    /// <summary>By count, highest first, then by name (ordinal), so equal counts always come in the same order. Zero counts are left out.</summary>
    private static List<NamedCount> Order(IEnumerable<NamedCount> counts) =>
        [.. counts.Where(static row => row.Count > 0)
            .OrderByDescending(static row => row.Count)
            .ThenBy(static row => row.Name, StringComparer.Ordinal)];

    /// <summary>Whole-percent shares over the full ordered list (<see cref="Shares.LargestRemainder"/>), then the first <paramref name="take"/> rows.</summary>
    private static List<RankedItemDto> Rank(List<NamedCount> ordered, int take)
    {
        var shares = Shares.LargestRemainder([.. ordered.Select(static row => row.Count)]);
        return [.. ordered.Take(take).Select((row, index) => new RankedItemDto(row.Name, (int)Math.Min(row.Count, int.MaxValue), shares[index]))];
    }

    /// <summary>
    /// One bucket per day or month of the range, oldest first: the store's counts where it has data, zeros elsewhere. A month
    /// bucket starts on the range's first day when the range starts mid-month.
    /// </summary>
    private static List<TrendBucketDto> Fill(DateOnly from, DateOnly to, StatsBucketKind bucket, IReadOnlyList<TrendCount> counts)
    {
        var byStart = counts.ToDictionary(count => count.Start);
        var trend = new List<TrendBucketDto>();
        for (var start = from; start <= to; start = Next(start, bucket))
        {
            var key = bucket == StatsBucketKind.Day ? start : new DateOnly(start.Year, start.Month, 1);
            trend.Add(new TrendBucketDto(Format(start), byStart.GetValueOrDefault(key)?.PageViews ?? 0));
        }

        return trend;
    }

    private static DateOnly Next(DateOnly start, StatsBucketKind bucket) =>
        bucket == StatsBucketKind.Day ? start.AddDays(1) : new DateOnly(start.Year, start.Month, 1).AddMonths(1);

    /// <summary>The range name and its first and last business day; a checked custom range is used as given, anything else is a preset.</summary>
    internal static (string Name, DateOnly From, DateOnly To) Resolve(VisitorStatsRequest request, DateOnly today)
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
