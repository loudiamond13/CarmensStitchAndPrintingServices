using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Checks the Edit Category form with the same field rules as the Add Category form (<see cref="ExpenseCategoryFieldsValidator"/>)
/// plus the version: base64 of exactly eight bytes, or the plain "Reload the form" message.
/// </summary>
public sealed class UpdateExpenseCategoryRequestValidator : AbstractValidator<UpdateExpenseCategoryRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateExpenseCategoryRequestValidator()
    {
        Include(new ExpenseCategoryFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
