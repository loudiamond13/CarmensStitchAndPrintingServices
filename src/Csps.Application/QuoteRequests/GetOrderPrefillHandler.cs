using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.QuoteRequests;

/// <summary>Use case: staff read the values the New Order form starts with for a quote request (INQ-06, D-20). Not built yet.</summary>
public sealed class GetOrderPrefillHandler(IQuoteRequestReader reader, IBusinessCalendar calendar, IRequestContext requestContext)
{
    /// <summary>Reads the prefill.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A 404 for now.</returns>
    public Task<Result<OrderPrefillResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        _ = (reader, calendar, requestContext, id, cancellationToken);
        return Task.FromResult(Result.Failure<OrderPrefillResponse>(QuoteRequestErrors.NotFound));
    }
}
