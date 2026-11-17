using Csps.Domain.Analytics;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Checks a speed report (ANL-05, the server half of OR-3): the path is sent, starts with a slash and is at most 2,048 characters before it is
/// cut. The metric values are not checked here: a value outside its range is dropped one by one, not refused (<see cref="VitalBounds"/>).
/// </summary>
public sealed class VitalsRequestValidator : AbstractValidator<VitalsRequest>
{
    /// <summary>Creates the validator.</summary>
    public VitalsRequestValidator()
    {
        RuleFor(request => request.Path)
            .Cascade(CascadeMode.Stop)
            .Must(static path => !string.IsNullOrEmpty(path)).WithMessage(PageViewRequestValidator.PathRequired)
            .Must(static path => path![0] == '/').WithMessage(PageViewRequestValidator.PathInvalid)
            .Must(static path => path!.Length <= AnalyticsPath.MaxLength).WithMessage(PageViewRequestValidator.PathTooLong);
    }
}
