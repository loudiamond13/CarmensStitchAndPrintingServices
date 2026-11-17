using System.Globalization;
using Csps.Application.Audit;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Checks the visitor stats query (the server half of OR-3). A preset, an unknown name or no range is never refused. A custom range needs a
/// start and an end day: real calendar days from the 3-year floor (D-04) to today in the business zone, the start not after the end. The date
/// messages are the Audit Log's, so the page shows the same words.
/// </summary>
public sealed class VisitorStatsRequestValidator : AbstractValidator<VisitorStatsRequest>
{
    /// <summary>The machine code of a query that breaks a rule.</summary>
    public const string InvalidCode = "analytics.invalid-visitor-stats";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a custom range with no start date.</summary>
    public const string StartRequired = "Enter a start date.";

    /// <summary>The message for a custom range with no end date.</summary>
    public const string EndRequired = "Enter an end date.";

    /// <summary>Creates the validator.</summary>
    /// <param name="calendar">The business calendar: today and, from it, the 3-year floor.</param>
    public VisitorStatsRequestValidator(IBusinessCalendar calendar)
    {
        ArgumentNullException.ThrowIfNull(calendar);

        RuleFor(request => request)
            .CustomAsync((request, context, cancellationToken) => CheckCustomRangeAsync(calendar, request, context, cancellationToken))
            .When(static request => request.Range == StatsRangePresets.Custom);
    }

    private static async Task CheckCustomRangeAsync(
        IBusinessCalendar calendar, VisitorStatsRequest request, ValidationContext<VisitorStatsRequest> context, CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var floor = AnalyticsRetention.DailyFloor(clock.Today);
        var window = $"Choose a date from {floor.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)} to today.";

        var fromInWindow = CheckDay(context, nameof(VisitorStatsRequest.From), request.From, StartRequired, floor, clock.Today, window, out var from);
        var toInWindow = CheckDay(context, nameof(VisitorStatsRequest.To), request.To, EndRequired, floor, clock.Today, window, out var to);
        if (fromInWindow && toInWindow && from > to)
        {
            context.AddFailure(nameof(VisitorStatsRequest.From), ListAuditLogRequestValidator.RangeOrderInvalid);
        }
    }

    // Adds the failure for one date and says whether it is a real day inside the window.
    private static bool CheckDay(
        ValidationContext<VisitorStatsRequest> context,
        string field,
        string? text,
        string required,
        DateOnly floor,
        DateOnly today,
        string window,
        out DateOnly day)
    {
        day = default;
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(field, required);
            return false;
        }

        if (!AuditLogFilters.TryParseDay(text, out day))
        {
            context.AddFailure(field, ListAuditLogRequestValidator.DateInvalid);
            return false;
        }

        if (day < floor || day > today)
        {
            context.AddFailure(field, window);
            return false;
        }

        return true;
    }
}
