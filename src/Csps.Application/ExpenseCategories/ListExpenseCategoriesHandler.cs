using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>Use case: staff read every expense category with its tone and status (D-08, D-11, D-15).</summary>
public sealed class ListExpenseCategoriesHandler(IExpenseCategories categories)
{
    /// <summary>Lists the categories in the order the store returns them: A to Z, Others last.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The categories.</returns>
    public async Task<Result<IReadOnlyList<ExpenseCategoryListItem>>> HandleAsync(CancellationToken cancellationToken)
    {
        var views = await categories.ListAsync(cancellationToken).ConfigureAwait(false);
        IReadOnlyList<ExpenseCategoryListItem> items =
        [
            .. views.Select(view => new ExpenseCategoryListItem(
                view.Id,
                view.Name,
                view.Tone,
                view.Retired ? ExpenseCategoryListItem.RetiredStatus : ExpenseCategoryListItem.ActiveStatus,
                view.IsOthers,
                view.ExpenseCount)),
        ];
        return Result.Success(items);
    }
}
