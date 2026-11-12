using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the weekly hours form (OR-3, CONT-01), with the UI-SPEC messages. The browser checks the same rules before it
/// sends anything. Day errors are keyed <c>days[i].opensAt</c> and <c>days[i].closesAt</c>.
/// </summary>
public sealed class UpdateOpeningHoursRequestValidator : AbstractValidator<UpdateOpeningHoursRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateOpeningHoursRequestValidator()
    {
        RuleFor(request => request.Version)
            .Must(static text => OpeningHoursVersion.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);

        RuleFor(request => request).Custom(static (request, context) => CheckDays(request.Days ?? [], context));
    }

    private static void CheckDays(IReadOnlyList<DayHoursDto> days, ValidationContext<UpdateOpeningHoursRequest> context)
    {
        for (var index = 0; index < days.Count; index++)
        {
            var day = days[index];
            var opens = !string.IsNullOrWhiteSpace(day?.OpensAt);
            var closes = !string.IsNullOrWhiteSpace(day?.ClosesAt);
            if (!opens && closes)
            {
                context.AddFailure(new ValidationFailure($"Days[{index}].OpensAt", OpeningHours.OpeningTimeRequiredMessage));
            }

            if (opens && !closes)
            {
                context.AddFailure(new ValidationFailure($"Days[{index}].ClosesAt", OpeningHours.ClosingTimeRequiredMessage));
            }
        }
    }
}
