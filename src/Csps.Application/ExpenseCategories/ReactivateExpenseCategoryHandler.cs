using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Use case: a Manager brings a retired expense category back so it can be chosen on a new expense again (CEXP-02, OQ-4). One
/// transaction clears the retirement and records <c>expense-category.reactivated</c> with the name (D-27). Reactivating a category
/// that is already active is a success that writes and audits nothing. No version is sent: the change applies to the latest state,
/// so a lost race is read again and decided again.
/// </summary>
public sealed class ReactivateExpenseCategoryHandler(
    IExpenseCategories categories,
    IAuditTrail audit,
    IUnitOfWork unitOfWork)
{
    private const string CategoryTarget = "ExpenseCategory";

    /// <summary>Brings the category back.</summary>
    /// <param name="id">The category to bring back.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already active), a 404 when the category does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<bool>(ExpenseCategoryErrors.NotFound);
        }

        if (!category.Reactivate())
        {
            return Result.Success(false);
        }

        audit.Record(AuditActions.ExpenseCategoryReactivated, CategoryTarget, AuditKey.Of(category.Id), CategoryAuditDetail.NameOnly(category.Name));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
