using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: staff of either role list orders (ORD-01, ORD-02). The query is checked first and the port is never called for a bad
/// one. Every figure comes from the stored totals; nothing is computed here. The business calendar gives the clock for the recent
/// window and the business today (D-59).
/// </summary>
public sealed class ListOrdersHandler(
    IOrderReader reader,
    IRequestContext requestContext,
    IBusinessCalendar calendar,
    IValidator<ListOrdersRequest> validator)
{
    /// <summary>Lists one page of orders.</summary>
    /// <param name="request">The filters, sort and page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderListResponse>> HandleAsync(ListOrdersRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderListResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderListResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = ListOrdersRequestValidator.TryParseStatus(request.Status, out var scope, out var status);
        _ = ListOrdersRequestValidator.TryParseSort(request.Sort, out var sort);
        var query = new OrderListQuery(
            string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim(),
            scope,
            status,
            OrderDetailsFieldsValidator.TryParseDate(request.From, out var from) ? from : null,
            OrderDetailsFieldsValidator.TryParseDate(request.To, out var to) ? to : null,
            ListOrdersRequestValidator.TryParseProductType(request.ProductType, out var productType) ? productType : null,
            request.HasBalance == true,
            sort,
            request.Page,
            request.PageSize);
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var page = await reader.ListAsync(query, clock.UtcNow, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<OrderListEntry> items =
        [
            .. page.Items.Select(row => new OrderListEntry(
                row.Id,
                row.Number,
                row.CustomerName,
                row.TeamName,
                row.OrderDate,
                row.DueDate,
                OrderStatusNames.ToKey(row.Status),
                row.StatusChangedAtUtc,
                row.Subtotal,
                row.Discount,
                row.Total,
                row.Paid,
                row.Refunded,
                row.Balance,
                row.CustomerCredit,
                row.FullyPaid,
                row.Pieces)),
        ];
        return Result.Success(new OrderListResponse(items, page.Total, request.Page, request.PageSize, page.AllOrders, page.ActiveOrders, default));
    }
}
