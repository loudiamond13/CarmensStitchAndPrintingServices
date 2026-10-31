using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Use case: a Manager deletes an expense category that no expense uses (CEXP-02, D-10, D-30). "Used" means an expense row exists
/// now, soft-deleted ones included, so a category whose every expense was deleted for good can be deleted again. A used category is
/// a 422 that points to Retire instead, and Others can never be deleted (OQ-6). The foreign key from the expenses is the backstop
/// for an expense added in the same moment: its refusal is the same 422. One transaction records <c>expense-category.deleted</c>
/// with the name and removes the row (D-27). No version is sent: the delete applies to the latest state, so a lost race is read
/// again and decided again, and a category that is gone is a 404.
/// </summary>
public sealed class DeleteExpenseCategoryHandler(
    IExpenseCategories categories,
    IAuditTrail audit,
    IUnitOfWork unitOfWork)
{
    private const string CategoryTarget = "ExpenseCategory";

    /// <summary>Deletes the category.</summary>
    /// <param name="id">The category to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the category does not exist, a 422 for Others or a category an expense uses, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (CategoryInUseException)
        {
            return Result.Failure(ExpenseCategoryErrors.InUse);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<bool>(ExpenseCategoryErrors.NotFound);
        }

        if (category.IsOthers)
        {
            return Result.Failure<bool>(ExpenseCategoryErrors.Protected);
        }

        if (await categories.CountExpensesAsync(category.Id, cancellationToken).ConfigureAwait(false) > 0)
        {
            return Result.Failure<bool>(ExpenseCategoryErrors.InUse);
        }

        audit.Record(AuditActions.ExpenseCategoryDeleted, CategoryTarget, AuditKey.Of(category.Id), CategoryAuditDetail.NameOnly(category.Name));
        categories.Remove(category);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
