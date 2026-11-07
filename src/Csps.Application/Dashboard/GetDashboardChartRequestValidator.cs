using FluentValidation;

namespace Csps.Application.Dashboard;

/// <summary>Checks the dashboard chart query (CWE-20).</summary>
public sealed class GetDashboardChartRequestValidator : AbstractValidator<GetDashboardChartRequest>
{
    /// <summary>The machine code of a chart query that breaks a rule.</summary>
    public const string InvalidCode = "dashboard.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";
}
