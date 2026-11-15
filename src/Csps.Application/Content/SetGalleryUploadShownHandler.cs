using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager hides a gallery upload or shows it again (GAL-03, PUB-03). Hiding takes it off the public site; nothing is lost.
/// One transaction flips the flag and writes <c>gallery-photo.hidden</c> or <c>gallery-photo.shown</c>. Hiding a hidden upload, or
/// showing a shown one, succeeds and changes and records nothing. An order item is not an upload and answers 404: it is taken off the
/// website from its order. No version is sent: the change applies to the latest state, so a lost race is read again and decided again.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="lines">The product line store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class SetGalleryUploadShownHandler(IGalleryEntries entries, IProductLines lines, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Shows or hides the upload.</summary>
    /// <param name="id">The upload.</param>
    /// <param name="shown">True to show it, false to hide it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already so), a 404 when it does not exist or is an order item, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, shown, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var entry = await entries.FindUploadAsync(id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        if (!(shown ? entry.Show() : entry.Hide()))
        {
            return Result.Success(false);
        }

        var titles = await lines.GetTitlesAsync([entry.ProductLineId!.Value], cancellationToken).ConfigureAwait(false);
        var title = titles.TryGetValue(entry.ProductLineId.Value, out var found) ? found : string.Empty;
        audit.Record(
            shown ? AuditActions.GalleryPhotoShown : AuditActions.GalleryPhotoHidden,
            GalleryAuditDetail.TargetType,
            AuditKey.Of(entry.Id),
            GalleryAuditDetail.Named(entry, title));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
