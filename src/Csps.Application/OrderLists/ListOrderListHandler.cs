using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>Use case: staff read one order list with each entry's tone and status (D-16, D-17, D-18, D-19).</summary>
public sealed class ListOrderListHandler(IOrderLists lists)
{
    /// <summary>Lists the entries A to Z ignoring letter case, the protected Others last, retired entries included.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The entries.</returns>
    public async Task<Result<IReadOnlyList<OrderListItem>>> HandleAsync(OrderListKind kind, CancellationToken cancellationToken)
    {
        var views = await lists.ListAsync(kind, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<OrderListItem> items =
        [
            .. views
                .OrderBy(view => view.IsOthers ? 1 : 0)
                .ThenBy(view => view.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(view => view.Id)
                .Select(view => new OrderListItem(
                    view.Id,
                    view.Name,
                    view.Tone,
                    view.Retired ? OrderListItem.RetiredStatus : OrderListItem.ActiveStatus,
                    view.IsOthers)),
        ];
        return Result.Success(items);
    }
}
