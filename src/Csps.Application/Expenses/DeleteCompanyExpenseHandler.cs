using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: a Manager soft-deletes a company expense (CEXP-02, D-01, D-02). The row stays, so its history and the audit trail stay,
/// but it leaves the list, its total, the KPIs and the detail. Who deleted it and when are set from the token and the clock, and Last
/// changed by follows (D-31). One transaction changes the row and records <c>company-expense.deleted</c> with the date, category,
/// amount and payer, never the description or notes (D-06, D-27). No version is sent: the delete applies to the latest state, so a
/// lost race is read again and decided again, and an expense that is gone or already deleted is a 404 that writes nothing.
/// </summary>
public sealed class DeleteCompanyExpenseHandler(
    ICompanyExpenses expenses,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time)
{
    private const string ExpenseTarget = "CompanyExpense";

    /// <summary>Deletes the expense.</summary>
    /// <param name="id">The expense to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when the expense does not exist or is already deleted, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, callerId, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, CancellationToken cancellationToken)
    {
        var expense = await expenses.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure<bool>(ExpenseErrors.NotFound);
        }

        if (!expense.SoftDelete(callerId, time.GetUtcNow()))
        {
            return Result.Failure<bool>(ExpenseErrors.NotFound);
        }

        audit.Record(
            AuditActions.CompanyExpenseDeleted,
            ExpenseTarget,
            AuditKey.Of(expense.Id),
            ExpenseAuditDetail.Snapshot(expense.ExpenseDate, expense.CategoryId, expense.Amount, expense.PaidByUserId));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
