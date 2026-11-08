using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a staff member reads their own ledger, one page at a time, newest first, with the running balance after every row
/// (MONEY-02, D-41). The balance after the newest row of the page is the current balance minus the rows newer than the page; the rest
/// of the page is walked down from there on the server. The person is the token's user.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="staff">Reads the caller's account and role.</param>
/// <param name="validator">Checks the page query.</param>
public sealed class GetLedgerHandler(IStaffMoneyReader reader, IRequestContext requestContext, IStaffDirectory staff, IValidator<GetLedgerRequest> validator)
{
    /// <summary>Reads one page of a ledger.</summary>
    /// <param name="userId">The person whose ledger is read; null means the caller. Another person's ledger is not served here.</param>
    /// <param name="request">The page query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, a 401 when the token names no usable account, or a 403 for another person's ledger.</returns>
    public async Task<Result<LedgerPageResponse>> HandleAsync(Guid? userId, GetLedgerRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<LedgerPageResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<LedgerPageResponse>(ValidationResults.ToError(validation, MoneyErrors.LedgerInvalidCode, Domain.Money.MoneyRules.InvalidMessage));
        }

        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        if (caller is null)
        {
            return Result.Failure<LedgerPageResponse>(AuthErrors.SessionEnded);
        }

        // Only a Manager sees deleted transfers; an Admin who asks is refused before any read (D-30, D-31).
        if (request.Deleted && !caller.IsManager)
        {
            return Result.Failure<LedgerPageResponse>(MoneyErrors.DeletedForbidden);
        }

        if (userId is { } other && other != callerId)
        {
            return Result.Failure<LedgerPageResponse>(MoneyErrors.Forbidden);
        }

        var page = await reader.GetLedgerPageAsync(callerId, request.Page, request.PageSize, includeDeleted: request.Deleted, cancellationToken).ConfigureAwait(false);
        var balances = LedgerRunningBalance.Apply(page.Rows, page.Balance - page.NewerSum);
        IReadOnlyList<LedgerEntryResponse> items = [.. page.Rows.Select((row, index) => LedgerEntryResponse.Of(row, balances[index]))];
        return Result.Success(new LedgerPageResponse(items, page.Total, request.Page, request.PageSize, page.Balance, IncludesDeleted: request.Deleted));
    }
}
