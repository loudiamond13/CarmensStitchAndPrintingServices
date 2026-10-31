using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: a Manager restores a soft-deleted expense so it counts again in the list, its total and the KPIs (CEXP-02, D-03). One
/// transaction clears the delete marker, Last changed by follows from the token and the clock (D-31), and the audit trail records
/// <c>company-expense.restored</c> with the date, category, amount and payer, never the description or notes (D-06, D-27). Restoring an
/// expense that is not deleted is a success that writes and audits nothing; an unknown id is a 404. No version is sent: the restore
/// applies to the latest state, so a lost race is read again and decided again.
/// </summary>
public sealed class RestoreCompanyExpenseHandler(
    ICompanyExpenses expenses,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    private const string ExpenseTarget = "CompanyExpense";

    /// <summary>Restores the expense.</summary>
    /// <param name="id">The expense to restore.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was not deleted), a 401 when the token names no usable account, a 404 when no such expense exists, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var expense = await expenses.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure<bool>(ExpenseErrors.NotFound);
        }

        if (!expense.Restore())
        {
            return Result.Success(false);
        }

        audit.Record(
            AuditActions.CompanyExpenseRestored,
            ExpenseTarget,
            AuditKey.Of(expense.Id),
            ExpenseAuditDetail.Snapshot(expense.ExpenseDate, expense.CategoryId, expense.Amount, expense.PaidByUserId));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
