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
        if (context.RootContextData.ContainsKey(EditKey) && !RowVersions.TryParse(request.Version, out _))
        {
            context.AddFailure(nameof(ShopClosureRequest.Version), RowVersions.InvalidMessage);
        }

        if (string.IsNullOrWhiteSpace(request.FirstDay))
        {
            context.AddFailure(nameof(ShopClosureRequest.FirstDay), ShopClosure.FirstDayRequiredMessage);
        }
        else if (!TryParseDay(request.FirstDay, out _))
        {
            context.AddFailure(nameof(ShopClosureRequest.FirstDay), ShopClosure.FirstDayInvalidMessage);
        }

        if (!string.IsNullOrWhiteSpace(request.LastDay) && !TryParseDay(request.LastDay, out _))
        {
            context.AddFailure(nameof(ShopClosureRequest.LastDay), ShopClosure.LastDayInvalidMessage);
        }
    }
}
