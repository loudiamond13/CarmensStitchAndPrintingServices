using System.Globalization;
using Csps.Application.Audit;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: a Manager reads unique visitors, visits and page views for a date range (ANL-08, D-24, D-33). Presets are resolved against the
/// business calendar, never the device clock. The read runs on demand with no cache.
/// </summary>
/// <param name="reader">The visitor stats read port.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">Checks the query.</param>
public sealed class GetVisitorStatsHandler(IVisitorStatsReader reader, IBusinessCalendar calendar, IValidator<VisitorStatsRequest> validator)
{
    private const string DateFormat = "yyyy-MM-dd";

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
            string.Empty,
            []));
    }

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
