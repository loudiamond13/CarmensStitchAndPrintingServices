using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>The CSV file of a range.</summary>
/// <param name="FileName">The file name, built only from the resolved dates.</param>
/// <param name="Csv">The CSV text, without a byte-order mark.</param>
public sealed record VisitorStatsExport(string FileName, string Csv);

/// <summary>
/// Use case: a Manager exports a date range as a CSV with one row per day and page that had views (ANL-08, D-69, D-75). The query is checked and
/// resolved like the stats read. A day or a page with no views has no line; a range with no views is the header alone. Rows are ordered by date,
/// then by the fixed page order, and an old key with no name shows its key after the named pages.
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
        var counts = await reader.ReadDailyPagesAsync(from, to, cancellationToken).ConfigureAwait(false);

        var rows = counts
            .Where(static count => count.Views > 0)
            .OrderBy(static count => count.Day)
            .ThenBy(static count => PageNames.OrderOf(count.PageKey))
            .ThenBy(static count => count.PageKey, StringComparer.Ordinal)
            .Select(static count => new DailyPageRow(count.Day, PageNames.NameFor(count.PageKey), count.Views))
            .ToList();

        return Result.Success(new VisitorStatsExport($"visitor-stats-{Format(from)}-to-{Format(to)}.csv", VisitorStatsCsv.Write(rows)));
    }

    private static string Format(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
