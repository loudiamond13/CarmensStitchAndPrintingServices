using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a Manager deletes an order and everything inside it for good, whether or not it was soft-deleted (ORD-06, D-28, D-29).
/// The caller types the order number as <c>confirm</c> and it must match exactly, letter for letter, or nothing is removed (400 on
/// <c>confirm</c>). In one transaction the audit trail records <c>order.permanently-deleted</c> first, with the money facts and the
/// people's user ids and never customer details or notes, and then the order is removed with its items, discounts, payments,
/// expenses, refunds and history, so the entry stays when the rows are gone. A tracked remove is used, not a bulk delete, so the
/// audit row and the delete share one save. Each photo file is queued for removal in that same save and nothing calls the photo storage
/// here (D-20, JOB-02), so a rolled-back delete queues nothing. No version is sent: the delete applies to the latest state, so a lost race is read again
/// and decided again, and an order that is already gone is a 404 that writes nothing. The 404 comes before the confirm check, so a
/// wrong id never learns anything about the order. An order that was shown on the website clears the public cache after the commit,
/// so it is gone from the public site at once (D-15, PUB-03). A quote request the order was made from lives exactly as long as the
/// order (13 D-22): the same save removes it with its photo places, notes and history, queues its stored photos as OrderDeleted and
/// records <c>quote-request.deleted</c> with the status and photo count only. A soft delete keeps the request and its link.
/// </summary>
public sealed class PermanentlyDeleteOrderHandler(
    IOrders orders,
    IAuditTrail audit,
    IImageDeletionQueue imageDeletions,
    IPublicContentCache publicCache,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IQuoteRequestStore quoteRequests)
{
    /// <summary>Deletes the order for good.</summary>
    /// <param name="id">The order to remove.</param>
    /// <param name="confirm">The order number as typed by the caller; null when none was sent.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when no such order exists, a 400 on <c>confirm</c> when it is not the exact number, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, string? confirm, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, confirm, token), cancellationToken),
                Result.Failure<bool>(EditErrors.Stale))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure(outcome.Error);
        }

        // The tracked remove clears the cache by itself; this call keeps a shown order from outliving its own delete if that rule is ever missed.
        if (outcome.Value)
        {
            await publicCache.InvalidateAsync(cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, string? confirm, CancellationToken cancellationToken)
    {
        var order = await orders.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        if (!string.Equals(confirm, order.Number, StringComparison.Ordinal))
        {
            return Result.Failure<bool>(OrderErrors.ConfirmMismatch);
        }

        audit.Record(
            AuditActions.OrderPermanentlyDeleted,
            OrderAuditDetail.OrderTarget,
            AuditKey.Of(order.Id),
            OrderAuditDetail.PermanentlyDeleted(order));
        foreach (var image in order.Images)
        {
            imageDeletions.Enqueue(image.PublicId, ImageDeletionReason.OrderDeleted);
        }

        // The request is removed before the order: its link has no cascade, so the order row is never left blocked or orphaned.
        if (await quoteRequests.FindByOrderAsync(order.Id, cancellationToken).ConfigureAwait(false) is { } quote)
        {
            List<string> stored = [.. quote.Photos.Select(static photo => photo.PublicId).OfType<string>()];
            foreach (var publicId in stored)
            {
                imageDeletions.Enqueue(publicId, ImageDeletionReason.OrderDeleted);
            }

            audit.Record(AuditActions.QuoteRequestDeleted, QuoteRequestAuditDetail.Target, AuditKey.Of(quote.Id), QuoteRequestAuditDetail.Deleted(quote.Status, stored.Count));
            quoteRequests.Remove(quote);
        }

        var wasShown = order.IsShownOnWebsite;
        orders.Remove(order);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(wasShown);
    }
}
