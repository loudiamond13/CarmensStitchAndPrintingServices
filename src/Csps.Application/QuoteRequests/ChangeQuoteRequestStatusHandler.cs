using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>Use case: staff move a quote request to another status (D-15).</summary>
public sealed class ChangeQuoteRequestStatusHandler(
    IQuoteRequestStore store,
    IQuoteRequestReader reader,
    IImageDelivery imageDelivery,
    IImageDeletionQueue deletions,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<ChangeQuoteRequestStatusRequest> validator)
{
    /// <summary>Moves the request.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="request">The new status and the version.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The request as saved, or the failure.</returns>
    public Task<Result<QuoteRequestDetailResponse>> HandleAsync(Guid id, ChangeQuoteRequestStatusRequest request, CancellationToken cancellationToken)
    {
        // Compile-only stub for the RED commit.
        _ = (store, reader, imageDelivery, deletions, calendar, audit, unitOfWork, requestContext, validator, id, request, cancellationToken);
        return Task.FromResult(Result.Failure<QuoteRequestDetailResponse>(QuoteRequestErrors.NotFound));
    }
}
