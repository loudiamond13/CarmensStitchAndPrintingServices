using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.QuoteRequests;

/// <summary>The number of quote requests still at status New, the same for every staff member (D-14).</summary>
/// <param name="Count">How many requests are at status New.</param>
public sealed record NewQuoteCountResponse(int Count);

/// <summary>Use case: staff of either role read the shared New count for the badge (INQ-05, D-14). No per-person state is kept.</summary>
public sealed class GetNewQuoteCountHandler(IQuoteRequestReader reader, IRequestContext requestContext)
{
    /// <summary>Reads the count.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The count, or a 401 when the token names no usable account.</returns>
    public async Task<Result<NewQuoteCountResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<NewQuoteCountResponse>(AuthErrors.SessionEnded);
        }

        var count = await reader.CountNewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new NewQuoteCountResponse(count));
    }
}
