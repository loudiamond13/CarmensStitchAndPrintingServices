using Csps.Domain.Expenses;
using FluentValidation;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// The one set of field rules for the Add Category and Edit Category forms (OR-3, D-13, OQ-10): a name of 1 to 40 characters after
/// trimming and a tone that is one of the six. Whether the name is already taken needs the database and runs in the handlers.
/// </summary>
public sealed class ExpenseCategoryFieldsValidator : AbstractValidator<IExpenseCategoryFields>
{
    /// <summary>Creates the validator.</summary>
    public ExpenseCategoryFieldsValidator()
    {
        RuleFor(request => request.Name)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(ExpenseCategoryRules.NameRequired)
            .Must(static text => text!.Trim().Length <= ExpenseCategory.NameMaxLength).WithMessage(ExpenseCategoryRules.NameTooLong);

        RuleFor(request => request.Tone)
            .Must(static tone => CategoryTones.IsValid(tone)).WithMessage(ExpenseCategoryRules.ToneInvalid);
    }
}
