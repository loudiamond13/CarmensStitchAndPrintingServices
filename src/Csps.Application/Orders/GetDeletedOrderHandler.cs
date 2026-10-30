using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a Manager reads a deleted order with every child row, read-only (D-24). A live or unknown order is the same 404. Only
/// Managers reach this handler; the route's policy enforces that.
/// </summary>
public sealed class GetDeletedOrderHandler(IOrderReader reader, IRequestContext requestContext)
{
    /// <summary>Reads one deleted order.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The deleted order, a 404 when it does not exist or is not deleted, or a 401 when the token names no usable account.</returns>
    public async Task<Result<DeletedOrderDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<DeletedOrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var view = await reader.GetDeletedDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<DeletedOrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }
}
