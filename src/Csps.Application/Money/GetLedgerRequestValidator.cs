using Csps.Application.Common;
using Csps.Application.Expenses;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>Checks the ledger page query with the shared list rules and words (SEC-03): the page size is 1 to 100 and the page is 1 to 100000.</summary>
public sealed class GetLedgerRequestValidator : AbstractValidator<GetLedgerRequest>
{
    /// <summary>Creates the validator.</summary>
    public GetLedgerRequestValidator()
    {
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page)
            .InclusiveBetween(1, ListCompanyExpensesRequestValidator.MaxPage)
            .WithMessage(ListCompanyExpensesRequestValidator.PageInvalid);
    }
}
