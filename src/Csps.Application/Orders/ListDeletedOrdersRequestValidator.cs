using Csps.Application.Common;
using Csps.Application.Users;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the deleted-order list query (SEC-03) with the same rules and words as the other lists: the page size uses the shared list
/// caps and the page is 1 to 100000.
/// </summary>
public sealed class ListDeletedOrdersRequestValidator : AbstractValidator<ListDeletedOrdersRequest>
{
    /// <summary>Creates the validator.</summary>
    public ListDeletedOrdersRequestValidator()
    {
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page)
            .InclusiveBetween(1, ListUsersRequestValidator.MaxPage)
            .WithMessage(ListUsersRequestValidator.PageInvalid);
    }
}
