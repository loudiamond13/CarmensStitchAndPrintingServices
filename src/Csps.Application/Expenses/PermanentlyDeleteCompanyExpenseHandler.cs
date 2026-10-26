using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: a Manager deletes a company expense for good, whether or not it was soft-deleted (CEXP-02, D-04). In one transaction the
/// audit trail records <c>company-expense.permanently-deleted</c> first, with the date, category, amount and payer and never the
/// description or notes (D-06, D-27), and then the row is removed, so the entry stays when the row is gone. A tracked remove is used,
/// not a bulk delete, so the audit row and the delete share one save. No version is sent: the delete applies to the latest state, so a
/// lost race is read again and decided again, and an expense that is already gone is a 404 that writes nothing.
/// </summary>
public sealed class PermanentlyDeleteCompanyExpenseHandler(
    ICompanyExpenses expenses,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    private const string ExpenseTarget = "CompanyExpense";

    /// <summary>Deletes the expense for good.</summary>
    /// <param name="id">The expense to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when no such expense exists, or a 409 when two saves lost a race twice.</returns>
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

        audit.Record(
            AuditActions.CompanyExpensePermanentlyDeleted,
            ExpenseTarget,
            AuditKey.Of(expense.Id),
            ExpenseAuditDetail.Snapshot(expense.ExpenseDate, expense.CategoryId, expense.Amount, expense.PaidByUserId));
        expenses.Remove(expense);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
