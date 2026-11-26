using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: a Manager deletes a quote request for good (D-16), for example on a visitor's data-removal request. The version is checked
/// first (400). Inside one transaction the request is found with its photo places (404), a request that became an order is refused
/// (400 <c>quote-requests.converted-locked</c>), the version the page was opened with is compared (409), each stored photo is queued for
/// the daily removal job with reason <see cref="ImageDeletionReason.QuoteDeleted"/>, and the request is removed with its photo places,
/// notes and history (the database cascades them). One <c>quote-request.deleted</c> entry with the status and the photo count, never
/// customer details, joins the same save. Nothing calls the photo storage here (D-34), so a rolled-back delete queues nothing.
/// </summary>
public sealed class DeleteQuoteRequestHandler(
    IQuoteRequestStore store,
    IImageDeletionQueue deletions,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    private static readonly Error InvalidVersion = Error.Validation(
        QuoteRequestErrors.ValidationCode,
        QuoteRequestErrors.ValidationMessage,
        new Dictionary<string, string[]> { [QuoteRequestErrors.VersionField] = [RowVersions.InvalidMessage] });

    /// <summary>Deletes the request.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="version">The version text the Manager last saw; checked before any lookup.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success, a 400 under <c>version</c> when it is missing or malformed, a 400 when the request became an order, a 401 when the token
    /// names no usable account, a 404 when there is no such request, or a 409 when the version is out of date or the save lost a race.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, string? version, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        if (!RowVersions.TryParse(version, out var sent))
        {
            return Result.Failure(InvalidVersion);
        }

        try
        {
            return await unitOfWork.InTransactionAsync(token => AttemptAsync(id, sent, token), cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure(QuoteRequestErrors.Conflict);
        }
    }

    private async Task<Result> AttemptAsync(Guid id, byte[] sent, CancellationToken cancellationToken)
    {
        var quote = await store.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (quote is null)
        {
            return Result.Failure(QuoteRequestErrors.NotFound);
        }

        if (quote.Status == QuoteRequestStatus.Converted)
        {
            return Result.Failure(QuoteRequestErrors.ConvertedDeleteLocked);
        }

        if (!quote.RowVersion.AsSpan().SequenceEqual(sent))
        {
            return Result.Failure(QuoteRequestErrors.Conflict);
        }

        // Files are only queued here; the daily removal job deletes them (D-34).
        List<string> stored = [.. quote.Photos.Select(static photo => photo.PublicId).OfType<string>()];
        foreach (var publicId in stored)
        {
            deletions.Enqueue(publicId, ImageDeletionReason.QuoteDeleted);
        }

        store.Remove(quote);
        audit.Record(
            AuditActions.QuoteRequestDeleted,
            QuoteRequestAuditDetail.Target,
            AuditKey.Of(quote.Id),
            QuoteRequestAuditDetail.Deleted(quote.Status, stored.Count));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
