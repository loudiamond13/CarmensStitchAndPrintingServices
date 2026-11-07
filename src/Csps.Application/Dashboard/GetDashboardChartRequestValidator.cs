using FluentValidation;

namespace Csps.Application.Dashboard;

/// <summary>Checks the dashboard chart query (CWE-20): the months are 6 or 12, or not sent. This runs before any figure is read.</summary>
public sealed class GetDashboardChartRequestValidator : AbstractValidator<GetDashboardChartRequest>
{
    /// <summary>The machine code of a chart query that breaks a rule.</summary>
    public const string InvalidCode = "dashboard.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a window other than 6 or 12 months.</summary>
    public const string MonthsInvalid = "Choose 6 or 12 months.";

    /// <summary>Creates the validator.</summary>
    public GetDashboardChartRequestValidator()
    {
        RuleFor(request => request.Months)
            .Must(static months => string.IsNullOrWhiteSpace(months)
                || (GetDashboardChartRequest.TryReadMonths(months, out var count) && GetDashboardChartRequest.AllowedMonths.Contains(count)))
            .WithMessage(MonthsInvalid);
    }
}
