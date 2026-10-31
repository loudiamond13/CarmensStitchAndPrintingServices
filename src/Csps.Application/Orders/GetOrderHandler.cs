using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>Use case: staff of either role read one order (ORD-03). A deleted or unknown order is the same 404.</summary>
public sealed class GetOrderHandler(IOrderReader reader, IRequestContext requestContext)
{
    /// <summary>Reads one order.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The order, a 404 when it does not exist or was deleted, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }
}
