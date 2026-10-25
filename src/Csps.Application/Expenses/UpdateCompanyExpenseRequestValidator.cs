using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Checks the Edit Expense form with the same field rules as the Add Expense form (<see cref="ExpenseFieldsValidator"/>) plus the
/// version: base64 of exactly eight bytes, or the plain "Reload the form" message (OQ-10). The business today is passed in
/// <see cref="ValidationContext{T}.RootContextData"/> under <see cref="TodayKey"/>.
/// </summary>
public sealed class UpdateCompanyExpenseRequestValidator : AbstractValidator<UpdateCompanyExpenseRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = ExpenseFieldsValidator.TodayKey;

    /// <summary>Creates the validator.</summary>
    public UpdateCompanyExpenseRequestValidator()
    {
        Include(new ExpenseFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
