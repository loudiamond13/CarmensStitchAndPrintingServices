using FluentValidation;

namespace Csps.Application.ExpenseCategories;

/// <summary>Checks the Add Category form with the shared field rules (<see cref="ExpenseCategoryFieldsValidator"/>).</summary>
public sealed class CreateExpenseCategoryRequestValidator : AbstractValidator<CreateExpenseCategoryRequest>
{
    /// <summary>Creates the validator.</summary>
    public CreateExpenseCategoryRequestValidator() => Include(new ExpenseCategoryFieldsValidator());
}
