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

        var photos = await context.Set<OrderImage>()
            .IgnoreQueryFilters([SoftDeleteFilter])
            .AsNoTracking()
            .Where(image => wanted.Contains(image.PublicId))
            .Select(image => image.PublicId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        found.UnionWith(photos);
        return found;
    }
}
