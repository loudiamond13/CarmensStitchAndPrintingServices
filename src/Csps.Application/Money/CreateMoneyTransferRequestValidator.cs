using System.Globalization;
using Csps.Domain.Money;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Checks the Transfer Money form with the rules the browser also applies (OR-3): a recipient, an amount, and a real
/// <c>yyyy-MM-dd</c> date. The business today is passed in <see cref="ValidationContext{T}.RootContextData"/> under
/// <see cref="TodayKey"/>. What needs the database (who the recipient is, what the sender holds) runs in the handler.
/// </summary>
public sealed class CreateMoneyTransferRequestValidator : AbstractValidator<CreateMoneyTransferRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = "today";

    /// <summary>Creates the validator.</summary>
    public CreateMoneyTransferRequestValidator()
    {
        RuleFor(request => request.ToUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(MoneyRules.ToRequired);

        RuleFor(request => request.Amount)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(MoneyRules.AmountRequired)
            .Must(static amount => amount > 0m).WithMessage(MoneyRules.AmountTooSmall);

        RuleFor(request => request.TransferDate).Custom(CheckDate);
    }

    /// <summary>Reads a date in <c>yyyy-MM-dd</c> form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="date">The date when the text is a real calendar day.</param>
    /// <returns>True when the text is a real <c>yyyy-MM-dd</c> date.</returns>
    public static bool TryParseDate(string? text, out DateOnly date)
    {
        date = default;
        return text is not null
            && DateOnly.TryParseExact(text.Trim(), MoneyRules.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static void CheckDate(string? text, ValidationContext<CreateMoneyTransferRequest> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(MoneyRules.DateRequired);
            return;
        }

        if (!TryParseDate(text, out _))
        {
            context.AddFailure(MoneyRules.DateInvalid);
        }
    }
}
