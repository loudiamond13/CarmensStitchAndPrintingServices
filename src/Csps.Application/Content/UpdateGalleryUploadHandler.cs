using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager edits a gallery upload with the version the form was opened with (GAL-03, SEC-07). The steps run in this order and
/// stop at the first failure: the form is checked (400), then in one transaction under the site-content lock the upload is found (404;
/// an order item is not an upload and is changed on its order), the version is the stored one (409), the line exists (400 on
/// <c>productLineId</c>) and the values are checked against the domain rules (400). A form save never retries on a conflict. A form
/// with no change saves nothing, writes no audit entry and keeps the version. A change writes <c>gallery-photo.changed</c> (the changed
/// fields, never the note), and a flip of the shown flag writes <c>gallery-photo.shown</c> or <c>gallery-photo.hidden</c>, in the same
/// save. The photo is replaced through its own route.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
/// <param name="delivery">Makes the thumb address of the answer.</param>
public sealed class UpdateGalleryUploadHandler(
    IGalleryEntries entries,
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<GalleryUploadRequest> validator,
    IImageDelivery delivery)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="id">The upload to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The item as saved, a 400 naming every field that failed, a 404 when it does not exist or is an order item, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<GalleryItemRowDto>> HandleAsync(Guid id, GalleryUploadRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var context = new ValidationContext<GalleryUploadRequest>(request);
        context.RootContextData[GalleryUploadRequestValidator.EditKey] = true;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<GalleryItemRowDto>(SiteContentErrors.Invalid(validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(id, version, request, token), cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<GalleryItemRowDto>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<GalleryItemRowDto>(EditErrors.Stale);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<GalleryItemRowDto>(AuthErrors.SessionBusy);
        }

        var row = await entries.GetItemAsync(id, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryItemNotFound)
            : Result.Success(GalleryItemRowDto.From(row, delivery));
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, byte[] version, GalleryUploadRequest request, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var entry = await entries.FindUploadAsync(id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        if (!entry.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        // The line is looked up before the change, so a refused edit leaves the tracked row untouched.
        var wanted = request.ProductLineId!.Value;
        var titles = await lines.GetTitlesAsync([wanted, entry.ProductLineId!.Value], cancellationToken).ConfigureAwait(false);
        if (!titles.ContainsKey(wanted))
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryLineUnknown);
        }

        var changed = entry.UpdateUpload(request.ToValues());
        if (changed.IsFailure)
        {
            return Result.Failure<bool>(changed.Error);
        }

        var change = changed.Value;
        if (!change.HasChange)
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(entry.Id);
        if (change.Fields.Count > 0)
        {
            audit.Record(AuditActions.GalleryPhotoChanged, GalleryAuditDetail.TargetType, key, GalleryAuditDetail.Changed(change, TitleOf(titles, change.OldLineId), TitleOf(titles, change.NewLineId)));
        }

        if (change.NowShown is { } shown)
        {
            audit.Record(shown ? AuditActions.GalleryPhotoShown : AuditActions.GalleryPhotoHidden, GalleryAuditDetail.TargetType, key, GalleryAuditDetail.Named(entry, TitleOf(titles, change.NewLineId)));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    private static string TitleOf(IReadOnlyDictionary<Guid, string> titles, Guid lineId) => titles.TryGetValue(lineId, out var title) ? title : string.Empty;
}
