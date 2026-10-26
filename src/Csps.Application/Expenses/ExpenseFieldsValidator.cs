using System.Globalization;
using Csps.Domain.Expenses;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// The one set of field rules for the Add Expense and Edit Expense forms (OR-3, D-19, D-20, D-21, OQ-10), so a save says the same
/// words whichever form sent it: a real <c>yyyy-MM-dd</c> date no later than thirty days after the business today, a category, a
/// description of 1 to 200 characters after trimming, an amount above 0.00 and at most 1,000,000.00 with two decimal places, a
/// payer, and notes of at most 1,000 characters. The business today is passed in <see cref="ValidationContext{T}.RootContextData"/>
/// under <see cref="TodayKey"/>. On an edit, the stored values under <see cref="StoredKey"/> exempt an unchanged amount, description
/// or notes from its limit (D-33). Whether the category and the payer exist and may be chosen needs the database and runs in the handlers.
/// </summary>
public sealed class ExpenseFieldsValidator : AbstractValidator<IExpenseFieldsRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = "today";

    /// <summary>
    /// The <see cref="ValidationContext{T}.RootContextData"/> key that holds the <see cref="StoredExpenseFields"/> of the edited
    /// expense. Absent on Add, where every limit applies.
    /// </summary>
    public const string StoredKey = "stored";

    /// <summary>Creates the validator.</summary>
    public ExpenseFieldsValidator()
    {
        RuleFor(request => request.Date).Custom(CheckDate);

        RuleFor(request => request.CategoryId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(ExpenseRules.CategoryRequired);

        RuleFor(request => request.Description)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(ExpenseRules.DescriptionRequired)
            .Must(static (_, text, context) => text!.Trim().Length <= ExpenseRules.DescriptionMaxLength
                || string.Equals(text.Trim(), Stored(context)?.Description, StringComparison.Ordinal))
            .WithMessage(ExpenseRules.DescriptionTooLong);

        RuleFor(request => request.Amount)
            .Cascade(CascadeMode.Stop)
            .Must(static amount => amount is > 0m).WithMessage(ExpenseRules.AmountTooSmall)
            .Must(static (_, amount, context) => amount <= ExpenseRules.AmountMax || amount == Stored(context)?.Amount)
            .WithMessage(ExpenseRules.AmountTooLarge)
            .PrecisionScale(18, ExpenseRules.AmountScale, true).WithMessage(ExpenseRules.AmountDecimals);

        RuleFor(request => request.PaidByUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(ExpenseRules.PaidByRequired);

        RuleFor(request => request.Notes)
            .Must(static (_, text, context) => text is null || text.Trim().Length <= ExpenseRules.NotesMaxLength
                || string.Equals(text.Trim(), Stored(context)?.Notes, StringComparison.Ordinal))
            .WithMessage(ExpenseRules.NotesTooLong);
    }

    /// <summary>Reads a date in <c>yyyy-MM-dd</c> form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="date">The date when the text is a real calendar day.</param>
    /// <returns>True when the text is a real <c>yyyy-MM-dd</c> date.</returns>
    public static bool TryParseDate(string? text, out DateOnly date)
    {
        date = default;
        return text is not null
            && DateOnly.TryParseExact(text.Trim(), ExpenseRules.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static StoredExpenseFields? Stored(ValidationContext<IExpenseFieldsRequest> context) =>
        context.RootContextData.TryGetValue(StoredKey, out var stored) ? stored as StoredExpenseFields : null;

    private static void CheckDate(string? text, ValidationContext<IExpenseFieldsRequest> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(ExpenseRules.DateRequired);
            return;
        }

        if (!TryParseDate(text, out var date))
        {
            context.AddFailure(ExpenseRules.DateInvalid);
            return;
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var today) || today is not DateOnly businessToday)
        {
            throw new InvalidOperationException($"The expense validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        var latest = ExpenseRules.Latest(businessToday);
        if (date > latest)
        {
            context.AddFailure(ExpenseRules.DateTooFar(latest));
        }
    }
}
