using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>The CSV file of a range.</summary>
/// <param name="FileName">The file name, built only from the resolved dates.</param>
/// <param name="Csv">The CSV text, without a byte-order mark.</param>
public sealed record VisitorStatsExport(string FileName, string Csv);

/// <summary>
/// Use case: a Manager exports a date range as a CSV with one row per business day (ANL-08, D-25, D-33). The query is checked and resolved like
/// the stats read. A day with no data is zeros; D-27: a day before the 13-month cut has no unique visitor or visit figure.
/// </summary>
/// <param name="reader">The visitor stats read port.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">Checks the query.</param>
public sealed class ExportVisitorStatsHandler(IVisitorStatsReader reader, IBusinessCalendar calendar, IValidator<VisitorStatsRequest> validator)
{
    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>Builds the CSV file.</summary>
    /// <param name="request">The query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The file name and its text.</returns>
    public async Task<Result<VisitorStatsExport>> HandleAsync(VisitorStatsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<VisitorStatsExport>(
                ValidationResults.ToError(validation, VisitorStatsRequestValidator.InvalidCode, VisitorStatsRequestValidator.InvalidMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var (_, from, to) = GetVisitorStatsHandler.Resolve(request, clock.Today);
        var cut = AnalyticsRetention.RawCut(clock.Today);
        var counts = await reader.ReadDailyAsync(from, to, cut, cancellationToken).ConfigureAwait(false);
        var byDay = counts.ToDictionary(static count => count.Day);

        var rows = new List<DailyStatsRow>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var count = byDay.GetValueOrDefault(day);
            var kept = day >= cut;
            rows.Add(new DailyStatsRow(day, kept ? count?.UniqueVisitors ?? 0 : null, kept ? count?.Visits ?? 0 : null, count?.PageViews ?? 0));
        }

        return Result.Success(new VisitorStatsExport($"visitor-stats-{Format(from)}-to-{Format(to)}.csv", VisitorStatsCsv.Write(rows)));
    }

    private static string Format(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
