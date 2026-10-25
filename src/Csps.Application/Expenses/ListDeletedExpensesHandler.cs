using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: a Manager lists the soft-deleted expenses, most recently deleted first (D-07). The query is checked first and the port is
/// never called for a bad one. Only Managers reach this handler; the route's policy enforces that (D-02).
/// </summary>
public sealed class ListDeletedExpensesHandler(
    ICompanyExpenseReader reader,
    IRequestContext requestContext,
    IValidator<ListDeletedExpensesRequest> validator)
{
    /// <summary>Lists one page of deleted expenses.</summary>
    /// <param name="request">The filters and page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, or a 401 when the token names no usable account.</returns>
    public async Task<Result<DeletedExpenseListResponse>> HandleAsync(ListDeletedExpensesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<DeletedExpenseListResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<DeletedExpenseListResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        _ = ListCompanyExpensesRequestValidator.TryParseCategory(request.Category, out var category);
        var search = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        var page = await reader
            .ListDeletedAsync(new DeletedExpenseListQuery(category == Guid.Empty ? null : category, search, request.Page, request.PageSize), cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<DeletedExpenseListItem> items =
        [
            .. page.Items.Select(row => new DeletedExpenseListItem(
                row.Id, row.DeletedAtUtc, row.DeletedBy, row.Date, row.Category, row.Description, row.Amount, row.PaidBy)),
        ];
        return Result.Success(new DeletedExpenseListResponse(items, page.Total, request.Page, request.PageSize));
    }
}
