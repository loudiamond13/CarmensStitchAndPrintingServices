using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>Use case: a Manager reads one category with its usage count, who recorded and last changed it, and its version (CEXP-02, D-10).</summary>
public sealed class GetExpenseCategoryHandler(IExpenseCategories categories)
{
    /// <summary>Reads the category.</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The category, or a 404 when it does not exist.</returns>
    public async Task<Result<ExpenseCategoryDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var view = await categories.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ExpenseCategoryDetailResponse>(ExpenseCategoryErrors.NotFound)
            : Result.Success(ExpenseCategoryDetailResponse.From(view));
    }
}
