using System.Globalization;
using Csps.Domain.Money;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Checks the Transfer Money form with the rules the browser also applies (OR-3): a recipient, an amount of at least 0.01 with at
/// most two decimal places, a real <c>yyyy-MM-dd</c> date that is not after the business today, and a note of at most 200
/// characters after trimming. The business today is passed in <see cref="ValidationContext{T}.RootContextData"/> under
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
            .Must(static amount => amount > 0m).WithMessage(MoneyRules.AmountTooSmall)
            .Must(static amount => MoneyRules.HasValidScale(amount!.Value)).WithMessage(MoneyRules.AmountDecimals);

        RuleFor(request => request.TransferDate).Custom(CheckDate);

        RuleFor(request => request.Note)
            .Must(static note => note is null || note.Trim().Length <= MoneyRules.NoteMaxLength).WithMessage(MoneyRules.NoteTooLong);
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

    /// <summary>Checks a transfer date for either form: required, a real <c>yyyy-MM-dd</c> day, not after the business today in the context.</summary>
    /// <typeparam name="T">The form type; the context must hold the business today under <see cref="TodayKey"/>.</typeparam>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="context">The validation context.</param>
    internal static void CheckDate<T>(string? text, ValidationContext<T> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(MoneyRules.DateRequired);
            return;
        }

        if (!TryParseDate(text, out var date))
        {
            context.AddFailure(MoneyRules.DateInvalid);
            return;
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var today) || today is not DateOnly businessToday)
        {
            throw new InvalidOperationException($"The transfer validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        if (date > businessToday)
        {
            context.AddFailure(MoneyRules.DateInFuture);
        }
    }
}
