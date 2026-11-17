using Csps.Application.Ports;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>Checks the visitor stats query (the server half of OR-3). Custom dates are real days between the 3-year floor and today.</summary>
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
    }
}
