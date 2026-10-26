using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Use case: a Manager retires an expense category so it can no longer be chosen on a new expense (CEXP-02, D-11). It stays in the
/// list and the list filter, marked retired, and old expenses keep it. One transaction marks the category and records
/// <c>expense-category.retired</c> with the name (D-27). Retiring a retired category is a success that writes and audits nothing;
/// Others can never be retired (OQ-6). No version is sent: the retire applies to the latest state, so a lost race is read again and
/// decided again.
/// </summary>
public sealed class RetireExpenseCategoryHandler(
    IExpenseCategories categories,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string CategoryTarget = "ExpenseCategory";

    /// <summary>Retires the category.</summary>
    /// <param name="id">The category to retire.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already retired), a 404 when the category does not exist, a 422 for Others, or a 409 when two saves lost a race twice.</returns>
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

        var retired = category.Retire(time.GetUtcNow());
        if (retired.IsFailure)
        {
            return Result.Failure<bool>(retired.Error);
        }

        if (!retired.Value)
        {
            return Result.Success(false);
        }

        audit.Record(AuditActions.ExpenseCategoryRetired, CategoryTarget, AuditKey.Of(category.Id), CategoryAuditDetail.NameOnly(category.Name));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
