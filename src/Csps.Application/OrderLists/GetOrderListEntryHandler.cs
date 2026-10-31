using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>Use case: a Manager reads one order list entry with its usage count, who recorded and last changed it, and its version (D-19).</summary>
public sealed class GetOrderListEntryHandler(IOrderLists lists)
{
    /// <summary>Reads the entry.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The entry, or a 404 when it does not exist in the list.</returns>
    public async Task<Result<OrderListEntryDetailResponse>> HandleAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken)
    {
        var view = await lists.GetDetailAsync(kind, id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.NotFound(OrderListDescriptor.For(kind)))
            : Result.Success(OrderListEntryDetailResponse.From(view));
    }
}
