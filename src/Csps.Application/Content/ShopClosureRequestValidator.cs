using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the closure form (OR-3, CONT-04), with the UI-SPEC messages. The browser checks the same rules before it sends
/// anything. The business today comes in <see cref="ValidationContext{T}.RootContextData"/> under <see cref="TodayKey"/>, and an edit is
/// marked with <see cref="EditKey"/>. What needs the database (an overlap with another closure) runs in the handlers under the lock.
/// </summary>
public sealed class ShopClosureRequestValidator : AbstractValidator<ShopClosureRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = "today";

    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that marks an edit: the version is then required.</summary>
    public const string EditKey = "edit";

    /// <summary>Creates the validator.</summary>
    public ShopClosureRequestValidator()
    {
        RuleFor(request => request).Custom(CheckForm);
    }

    /// <summary>Reads a day in <c>yyyy-MM-dd</c> form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="day">The day when the text is a real calendar day.</param>
    /// <returns>True when the text is a real <c>yyyy-MM-dd</c> date.</returns>
    public static bool TryParseDay(string? text, out DateOnly day)
    {
        day = default;
        return text is not null
            && DateOnly.TryParseExact(text.Trim(), ShopClosureDto.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out day);
    }

    private static void CheckForm(ShopClosureRequest request, ValidationContext<ShopClosureRequest> context)
    {
        var editing = context.RootContextData.ContainsKey(EditKey);
        if (editing && !RowVersions.TryParse(request.Version, out _))
        {
            context.AddFailure(nameof(ShopClosureRequest.Version), RowVersions.InvalidMessage);
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var value) || value is not DateOnly today)
        {
            throw new InvalidOperationException($"The closure validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        var firstRead = TryParseDay(request.FirstDay, out var firstDay);
        if (string.IsNullOrWhiteSpace(request.FirstDay))
        {
            context.AddFailure(nameof(ShopClosureRequest.FirstDay), ShopClosure.FirstDayRequiredMessage);
        }
        else if (!firstRead)
        {
            context.AddFailure(nameof(ShopClosureRequest.FirstDay), ShopClosure.FirstDayInvalidMessage);
        }

        var lastGiven = !string.IsNullOrWhiteSpace(request.LastDay);
        var lastRead = TryParseDay(request.LastDay, out var lastDay);
        if (lastGiven && !lastRead)
        {
            context.AddFailure(nameof(ShopClosureRequest.LastDay), ShopClosure.LastDayInvalidMessage);
        }

        // The domain rules judge only what could be read, so a bad date never causes a made-up second error. An edit keeps a first day that is already past.
        var errors = ShopClosure.Check(
            firstRead ? firstDay : today,
            firstRead && lastGiven && lastRead ? lastDay : null,
            request.Note,
            today,
            requireFirstDayFromToday: firstRead && !editing);
        foreach (var field in new[] { "firstDay", "lastDay", "note" })
        {
            if (errors.TryGetValue(field, out var messages))
            {
                context.AddFailure(char.ToUpperInvariant(field[0]) + field[1..], messages[0]);
            }
        }
    }
}
