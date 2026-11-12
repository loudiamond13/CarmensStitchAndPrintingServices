using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the weekly hours form (OR-3, CONT-01), with the UI-SPEC messages. The browser checks the same rules before it
/// sends anything. Times are "HH:mm" on the half hour from 05:00 to 23:30, an open day needs both, and closing must be after opening
/// (the domain rules in <see cref="OpeningHours.Check"/>). All seven days are sent once each, in any order. Day errors are keyed
/// <c>days[i].opensAt</c> and <c>days[i].closesAt</c>, by the day's place in the request; a problem with the list is keyed <c>days</c>.
/// </summary>
public sealed class UpdateOpeningHoursRequestValidator : AbstractValidator<UpdateOpeningHoursRequest>
{
    /// <summary>The message for a list that is not the seven days once each.</summary>
    public const string DaysMessage = "Send the hours for all seven days, once each.";

    /// <summary>Creates the validator.</summary>
    public UpdateOpeningHoursRequestValidator()
    {
        RuleFor(request => request.Version)
            .Must(static text => OpeningHoursVersion.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);

        RuleFor(request => request).Custom(static (request, context) => CheckDays(request.Days ?? [], context));
    }

    private static void CheckDays(IReadOnlyList<DayHoursDto> days, ValidationContext<UpdateOpeningHoursRequest> context)
    {
        if (!IsWholeWeek(days))
        {
            context.AddFailure(new ValidationFailure("Days", DaysMessage));
            return;
        }

        for (var index = 0; index < days.Count; index++)
        {
            foreach (var (field, messages) in CheckDay(days[index]))
            {
                context.AddFailure(new ValidationFailure($"Days[{index}].{char.ToUpperInvariant(field[0])}{field[1..]}", messages[0]));
            }
        }
    }

    private static bool IsWholeWeek(IReadOnlyList<DayHoursDto> days) =>
        days.Count == OpeningHours.DayCount
        && days.All(static day => day is not null)
        && days.Select(static day => day.Day).Distinct().Count() == OpeningHours.DayCount
        && days.All(static day => day.Day is >= OpeningHours.FirstDay and <= OpeningHours.LastDay);

    // A time that does not read as "HH:mm" gets the same message as one off the half hour. When one side cannot be read, the domain
    // rules cannot compare the two, so only the missing-time message for the other side is added here.
    private static Dictionary<string, string[]> CheckDay(DayHoursDto day)
    {
        var opens = Read(day.OpensAt, out var opensAt);
        var closes = Read(day.ClosesAt, out var closesAt);
        if (opens != TimeText.Unreadable && closes != TimeText.Unreadable)
        {
            return OpeningHours.Check(opensAt, closesAt);
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (opens == TimeText.Unreadable)
        {
            errors["opensAt"] = [OpeningHours.TimeStepMessage];
        }

        if (closes == TimeText.Unreadable)
        {
            errors["closesAt"] = [OpeningHours.TimeStepMessage];
        }

        if (opens == TimeText.Blank)
        {
            errors["opensAt"] = [OpeningHours.OpeningTimeRequiredMessage];
        }

        if (closes == TimeText.Blank)
        {
            errors["closesAt"] = [OpeningHours.ClosingTimeRequiredMessage];
        }

        return errors;
    }

    private static TimeText Read(string? text, out TimeOnly? time)
    {
        time = null;
        if (string.IsNullOrWhiteSpace(text))
        {
            return TimeText.Blank;
        }

        if (!DayHoursDto.TryParseTime(text, out var parsed))
        {
            return TimeText.Unreadable;
        }

        time = parsed;
        return TimeText.Read;
    }

    private enum TimeText
    {
        Blank,
        Unreadable,
        Read,
    }
}
