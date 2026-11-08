using Csps.Application.Common;
using Csps.Application.Expenses;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>Checks the transfer list query with the shared list rules and words (SEC-03): the page size is 1 to 100 and the page is 1 to 100000.</summary>
public sealed class ListMoneyTransfersRequestValidator : AbstractValidator<ListMoneyTransfersRequest>
{
    /// <summary>Creates the validator.</summary>
    public ListMoneyTransfersRequestValidator()
    {
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page)
            .InclusiveBetween(1, ListCompanyExpensesRequestValidator.MaxPage)
            .WithMessage(ListCompanyExpensesRequestValidator.PageInvalid);
    }
}
