using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager moves a gallery item, an order or an upload, one place up or down in the one gallery order (GAL-03, D-14, PUB-03).
/// In one transaction under the site-content lock the item trades places with its visible neighbour: the next item in the Manager's
/// list, or, when the list is filtered to a line, the next item of that line. Two Managers moving at once are decided one after the other,
/// so every place is used once. A move at the end of the list succeeds and changes and records nothing. A change writes one
/// <c>gallery-item.moved</c> entry with the kind, the name shown and the old and new place in the list (counted from 1). An item that is
/// not in the list, or not in the filtered line, is a 404. No version is sent: the move applies to the latest order, so a lost race is read
/// again and decided again. Home's Recent work does not follow this order (D-14).
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class MoveGalleryItemHandler(
    IGalleryEntries entries,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<MoveGalleryItemRequest> validator)
{
    /// <summary>Moves the item.</summary>
    /// <param name="id">The gallery entry to move.</param>
    /// <param name="request">The direction and the line filter.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 for a direction that is not up or down, a 404 when the item is not in the list, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, MoveGalleryItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(SiteContentErrors.Invalid(validation));
        }

        var up = string.Equals(request.Direction, MoveProductLineRequestValidator.Up, StringComparison.OrdinalIgnoreCase);
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, up, request.LineId, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool up, Guid? lineId, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var order = await entries.ListOrderAsync(cancellationToken).ConfigureAwait(false);
        var item = order.FirstOrDefault(place => place.Id == id);
        if (item is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        // The neighbour is the next item of the filtered list: every line, or only the line the Manager is looking at.
        IReadOnlyList<GalleryOrderRef> view = lineId is { } line ? [.. order.Where(place => place.LineId == line)] : order;
        var at = view.ToList().FindIndex(place => place.Id == id);
        if (at < 0)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        var next = up ? at - 1 : at + 1;
        if (next < 0 || next >= view.Count)
        {
            return Result.Success(false);
        }

        var neighbour = view[next];
        var entry = await entries.FindAsync(id, cancellationToken).ConfigureAwait(false);
        var other = await entries.FindAsync(neighbour.Id, cancellationToken).ConfigureAwait(false);
        if (entry is null || other is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        // The audit entry counts places in the whole list from 1, so it reads the same with or without a line filter.
        var oldRank = order.ToList().FindIndex(place => place.Id == id) + 1;
        var newRank = order.ToList().FindIndex(place => place.Id == neighbour.Id) + 1;
        entry.SwapPositionWith(other);
        audit.Record(
            AuditActions.GalleryItemMoved,
            GalleryAuditDetail.TargetType,
            AuditKey.Of(entry.Id),
            GalleryAuditDetail.Moved(item.Kind, item.Name, oldRank, newRank));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
