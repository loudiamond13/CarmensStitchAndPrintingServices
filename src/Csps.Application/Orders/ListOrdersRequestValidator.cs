using Csps.Application.Common;
using Csps.Application.Users;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>Checks the order list query (SEC-03, WEB-10): the page size and search use the shared list caps and the page is 1 to 100000.</summary>
public sealed class ListOrdersRequestValidator : AbstractValidator<ListOrdersRequest>
{
    /// <summary>Creates the validator.</summary>
    public ListOrdersRequestValidator()
    {
        RuleFor(request => request.Q).SearchText();
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page)
            .InclusiveBetween(1, ListUsersRequestValidator.MaxPage)
            .WithMessage(ListUsersRequestValidator.PageInvalid);
    }
}
