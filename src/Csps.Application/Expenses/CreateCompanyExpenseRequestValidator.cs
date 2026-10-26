using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Checks the Add Expense form with the rules the browser also applies (OR-3), held in <see cref="ExpenseFieldsValidator"/> so the
/// Edit Expense form says the same words. The business today is passed in <see cref="ValidationContext{T}.RootContextData"/> under
/// <see cref="TodayKey"/>. Whether the category and the payer exist and may be chosen needs the database and runs in the handler.
/// </summary>
public sealed class CreateCompanyExpenseRequestValidator : AbstractValidator<CreateCompanyExpenseRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = ExpenseFieldsValidator.TodayKey;

    /// <summary>Creates the validator.</summary>
    public CreateCompanyExpenseRequestValidator()
    {
        Include(new ExpenseFieldsValidator());
    }

    /// <summary>Reads a date in <c>yyyy-MM-dd</c> form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="date">The date when the text is a real calendar day.</param>
    /// <returns>True when the text is a real <c>yyyy-MM-dd</c> date.</returns>
    public static bool TryParseDate(string? text, out DateOnly date) => ExpenseFieldsValidator.TryParseDate(text, out date);
}
