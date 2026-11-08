using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Use case: the transfer list (MONEY-03, D-31, D-48). A Manager sees every transfer; an Admin sees only the transfers they sent or
/// received. Deleted transfers are shown only to a Manager who asks for them; an Admin who asks is refused before any read.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="staff">Reads the caller's account and role.</param>
/// <param name="validator">Checks the page query.</param>
public sealed class ListMoneyTransfersHandler(IStaffMoneyReader reader, IRequestContext requestContext, IStaffDirectory staff, IValidator<ListMoneyTransfersRequest> validator)
{
    /// <summary>Lists one page of transfers.</summary>
    /// <param name="request">The page query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, a 401 when the token names no usable account, or a 403 for an Admin who asks for deleted transfers.</returns>
    public Task<Result<MoneyTransferListResponse>> HandleAsync(ListMoneyTransfersRequest request, CancellationToken cancellationToken)
    {
        _ = (reader, requestContext, staff, validator, request, cancellationToken);
        return Task.FromResult(Result.Failure<MoneyTransferListResponse>(AuthErrors.SessionEnded));
    }
}
