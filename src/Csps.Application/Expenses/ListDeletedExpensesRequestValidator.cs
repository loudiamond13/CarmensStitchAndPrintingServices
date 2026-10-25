using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Checks the deleted-expense list query (SEC-03, WEB-10) with the same rules and words as the live list: the search and page size use
/// the shared list caps, the page is 1 to 100000 and the category is a dashed id.
/// </summary>
public sealed class ListDeletedExpensesRequestValidator : AbstractValidator<ListDeletedExpensesRequest>
{
    /// <summary>Creates the validator.</summary>
    public ListDeletedExpensesRequestValidator()
    {
        RuleFor(request => request.Q).SearchText();
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page)
            .InclusiveBetween(1, ListCompanyExpensesRequestValidator.MaxPage)
            .WithMessage(ListCompanyExpensesRequestValidator.PageInvalid);
        RuleFor(request => request.Category)
            .Must(static category => string.IsNullOrWhiteSpace(category) || ListCompanyExpensesRequestValidator.TryParseCategory(category, out _))
            .WithMessage(ListCompanyExpensesRequestValidator.CategoryInvalid);
    }
}
