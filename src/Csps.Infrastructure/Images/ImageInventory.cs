using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Images;

/// <summary>
/// Reads which stored photo files the database knows (JOB-02, D-23). The photo query lifts the named SoftDelete filter, so a photo of a
/// soft-deleted order still counts: the order can be restored and a Cloudinary removal cannot be undone.
/// </summary>
/// <param name="context">The database context.</param>
internal sealed class ImageInventory(CspsDbContext context) : IImageInventory
{
    private const string SoftDeleteFilter = "SoftDelete";

    /// <inheritdoc />
    public async Task<IReadOnlySet<string>> KnownAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken)
    {
        var known = await PhotoIdsAsync(publicIds, cancellationToken).ConfigureAwait(false);
        var wanted = Wanted(publicIds);
        if (wanted.Count == 0)
        {
            return known;
        }

        var queued = await context.Set<ImageDeletion>()
            .AsNoTracking()
            .Where(row => wanted.Contains(row.PublicId))
            .Select(row => row.PublicId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        known.UnionWith(queued);
        return known;
    }

    /// <inheritdoc />
    public async Task<IReadOnlySet<string>> NamedByPhotosAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken) =>
        await PhotoIdsAsync(publicIds, cancellationToken).ConfigureAwait(false);

    private static List<string> Wanted(IReadOnlyCollection<string> publicIds)
    {
        ArgumentNullException.ThrowIfNull(publicIds);
        return [.. publicIds.Distinct(StringComparer.Ordinal)];
    }

    private async Task<HashSet<string>> PhotoIdsAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken)
    {
        var wanted = Wanted(publicIds);
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (wanted.Count == 0)
        {
            return found;
        }

        // Order photos, product line photos, gallery uploads and the share picture in one command: a row of any of the four names its file.
        var photos = await context.Set<OrderImage>()
            .IgnoreQueryFilters([SoftDeleteFilter])
            .AsNoTracking()
            .Where(image => wanted.Contains(image.PublicId))
            .Select(image => image.PublicId)
            .Union(context.ProductLinePhotos.AsNoTracking().Where(photo => wanted.Contains(photo.PublicId)).Select(photo => photo.PublicId))
            .Union(context.GalleryEntries.AsNoTracking().Where(entry => entry.PublicId != null && wanted.Contains(entry.PublicId)).Select(entry => entry.PublicId!))
            .Union(context.SiteSettings.AsNoTracking().Where(settings => settings.SharePicturePublicId != null && wanted.Contains(settings.SharePicturePublicId)).Select(settings => settings.SharePicturePublicId!))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        found.UnionWith(photos);
        return found;
    }
}
