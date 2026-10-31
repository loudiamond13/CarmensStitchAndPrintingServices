using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a Manager lists the soft-deleted orders, most recently deleted first (D-28). The query is checked first and the port is
/// never called for a bad one. Only Managers reach this handler; the route's policy enforces that.
/// </summary>
public sealed class ListDeletedOrdersHandler(
    IOrderReader reader,
    IRequestContext requestContext,
    IValidator<ListDeletedOrdersRequest> validator)
{
    /// <summary>Lists one page of deleted orders.</summary>
    /// <param name="request">The page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, or a 401 when the token names no usable account.</returns>
    public async Task<Result<DeletedOrderListResponse>> HandleAsync(ListDeletedOrdersRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<DeletedOrderListResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<DeletedOrderListResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var page = await reader.ListDeletedAsync(request.Page, request.PageSize, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<DeletedOrderListItem> items =
        [
            .. page.Items.Select(row => new DeletedOrderListItem(
                row.Id,
                row.Number,
                row.CustomerName,
                row.TeamName,
                OrderStatusNames.ToKey(row.Status),
                row.Total,
                row.Paid,
                row.Balance,
                row.DeletedAtUtc,
                row.DeletedBy)),
        ];
        return Result.Success(new DeletedOrderListResponse(items, page.Total, request.Page, request.PageSize));
    }
}
