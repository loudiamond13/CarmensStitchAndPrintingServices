using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a staff member reads a ledger, one page at a time, newest first, with the running balance after every row
/// (MONEY-02, D-41). The balance after the newest row of the page is the current balance minus the rows newer than the page; the rest
/// of the page is walked down from there on the server. The person is the token's user unless a Manager names another staff member
/// (MONEY-03); an Admin may name only themselves.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="staff">Reads the caller's account and role.</param>
/// <param name="validator">Checks the page query.</param>
public sealed class GetLedgerHandler(IStaffMoneyReader reader, IRequestContext requestContext, IStaffDirectory staff, IValidator<GetLedgerRequest> validator)
{
    /// <summary>Reads one page of a ledger.</summary>
    /// <param name="userId">The person whose ledger is read; null means the caller.</param>
    /// <param name="request">The page query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, a 401 when the token names no usable account, a 403 for an Admin asking about someone else or for deleted transfers, or a 404 for a Manager asking about no staff member.</returns>
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

        // The role is decided from the caller's own account before anyone else is looked up (MONEY-03, CWE-639, CWE-204).
        var target = userId ?? callerId;
        var access = StaffMoneyAccess.Check(callerId, caller, target);
        if (access.IsFailure)
        {
            return Result.Failure<LedgerPageResponse>(access.Error);
        }

        // Only a Manager sees deleted transfers; an Admin who asks is refused before any read (D-30, D-31).
        if (request.Deleted && !caller.IsManager)
        {
            return Result.Failure<LedgerPageResponse>(MoneyErrors.DeletedForbidden);
        }

        if (target != callerId)
        {
            var found = await StaffMoneyAccess.FindAsync(staff, caller, target, cancellationToken).ConfigureAwait(false);
            if (found.IsFailure)
            {
                return Result.Failure<LedgerPageResponse>(found.Error);
            }
        }

        var page = await reader.GetLedgerPageAsync(target, request.Page, request.PageSize, includeDeleted: request.Deleted, cancellationToken).ConfigureAwait(false);
        var balances = LedgerRunningBalance.Apply(page.Rows, page.Balance - page.NewerSum);
        IReadOnlyList<LedgerEntryResponse> items = [.. page.Rows.Select((row, index) => LedgerEntryResponse.Of(row, balances[index]))];
        return Result.Success(new LedgerPageResponse(items, page.Total, request.Page, request.PageSize, page.Balance, IncludesDeleted: request.Deleted));
    }
}
