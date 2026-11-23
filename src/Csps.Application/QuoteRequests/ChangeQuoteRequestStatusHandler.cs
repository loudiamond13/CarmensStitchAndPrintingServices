using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role move a quote request to another status (D-13, D-15). The body is checked first (400). Inside one
/// transaction the request is found (404), the version the page was opened with is compared (409), and the domain decides the move
/// (400 for the same status or a Converted request). A move adds a history row and one <c>quote-request.status-changed</c> entry in the
/// same save. Who moved it and when come from the token and the clock (SEC-08). Leaving New takes the request off the shared New
/// count at once (D-14).
/// </summary>
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
    /// <returns>
    /// The request as saved, a 400 on the status or version, a 401 when the token names no usable account, a 404 when there is no such
    /// request, or a 409 when the version is out of date.
    /// </returns>
    public async Task<Result<QuoteRequestDetailResponse>> HandleAsync(Guid id, ChangeQuoteRequestStatusRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<QuoteRequestDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<QuoteRequestDetailResponse>(
                ValidationResults.ToError(validation, QuoteRequestErrors.ValidationCode, QuoteRequestErrors.ValidationMessage));
        }

        _ = ChangeQuoteRequestStatusRequestValidator.TryParseHandSet(request.Status, out var target);
        _ = RowVersions.TryParse(request.Version, out var version);
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                async token =>
                {
                    var quote = await store.FindAsync(id, token).ConfigureAwait(false);
                    if (quote is null)
                    {
                        return Result.Failure<bool>(QuoteRequestErrors.NotFound);
                    }

                    if (!quote.RowVersion.AsSpan().SequenceEqual(version))
                    {
                        return Result.Failure<bool>(QuoteRequestErrors.Conflict);
                    }

                    var from = quote.Status;
                    var moved = quote.ChangeStatus(target, callerId, clock.UtcNow);
                    if (moved.IsFailure)
                    {
                        return Result.Failure<bool>(moved.Error);
                    }

                    // Files are only queued here; the daily removal job deletes them (D-04, D-34).
                    foreach (var publicId in moved.Value)
                    {
                        deletions.Enqueue(publicId, ImageDeletionReason.QuoteSpam);
                    }

                    audit.Record(
                        AuditActions.QuoteRequestStatusChanged,
                        QuoteRequestAuditDetail.Target,
                        AuditKey.Of(quote.Id),
                        QuoteRequestAuditDetail.StatusChanged(from, target));
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return Result.Success(true);
                },
                cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<QuoteRequestDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<QuoteRequestDetailResponse>(QuoteRequestErrors.Conflict);
        }

        return await GetQuoteRequestHandler.ReadAsync(reader, imageDelivery, id, cancellationToken).ConfigureAwait(false);
    }
}
