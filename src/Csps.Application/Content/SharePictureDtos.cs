using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The default link preview picture as the Business Info card shows it (D-26): a small and a larger preview at the 1.91:1 shape, and
/// the size of the stored file. A site with no picture has none of this: the settings carry null.
/// </summary>
/// <param name="Src320">The address of the 320 x 168 preview.</param>
/// <param name="Src640">The address of the 640 x 336 preview, for the full-width view on a phone.</param>
/// <param name="Width">The upright width of the stored picture in pixels.</param>
/// <param name="Height">The upright height of the stored picture in pixels.</param>
public sealed record SharePictureDto(string Src320, string Src640, int Width, int Height)
{
    /// <summary>Maps the stored picture of the settings row to its DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width.</param>
    /// <param name="height">The stored upright height.</param>
    /// <param name="delivery">Makes the addresses.</param>
    /// <returns>The DTO.</returns>
    public static SharePictureDto From(string publicId, int width, int height, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(publicId);
        ArgumentNullException.ThrowIfNull(delivery);
        var previews = delivery.ForSharePreview(publicId);
        return new SharePictureDto(previews.Src320, previews.Src640, width, height);
    }
}
