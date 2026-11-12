using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One photo of a product line as the Manager's screens read it (D-02).</summary>
/// <param name="Slot">The place on the line: <c>main</c>, <c>back</c> or <c>fabric</c>.</param>
/// <param name="Src">The address of the preview at a size that fits the slot.</param>
/// <param name="SrcSet">The <c>srcset</c> text with the smaller and larger candidates.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
public sealed record ProductLinePhotoDto(string Slot, string Src, string SrcSet, int Width, int Height);

/// <summary>The three photo slots of a product line as the Manager's editor reads them; a slot with no photo is null.</summary>
/// <param name="Main">The main photo.</param>
/// <param name="Back">The back view.</param>
/// <param name="Fabric">The fabric detail.</param>
public sealed record ProductLinePhotosDto(ProductLinePhotoDto? Main, ProductLinePhotoDto? Back, ProductLinePhotoDto? Fabric)
{
    /// <summary>Gets the slots of a line with no photo.</summary>
    public static ProductLinePhotosDto None { get; } = new(null, null, null);
}

/// <summary>
/// Turns line photo rows into their DTOs (manual mapping, PRD section 3.3). The delivery port makes every address, so no screen builds
/// one. The main photo uses the 4:5 card candidates on the Manager's screens and the product large candidates on the public page; the back
/// view and the fabric detail use the 1:1 candidates on both.
/// </summary>
public static class ProductLinePhotoMapper
{
    /// <summary>Maps one photo for the Manager's screens.</summary>
    /// <param name="photo">The photo row.</param>
    /// <param name="delivery">Makes the addresses.</param>
    /// <returns>The DTO.</returns>
    public static ProductLinePhotoDto ToAdmin(ProductLinePhoto photo, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(photo);
        ArgumentNullException.ThrowIfNull(delivery);
        var urls = delivery.ForLinePhoto(photo.PublicId, photo.Width, photo.Height);
        var source = photo.Slot == ProductLinePhotoSlot.Main ? urls.Card : urls.Small;
        return new ProductLinePhotoDto(ProductLinePhotoSlots.ToText(photo.Slot), source.Src, source.SrcSet, photo.Width, photo.Height);
    }

    /// <summary>Maps the photos of one line for the Manager's editor.</summary>
    /// <param name="photos">The photo rows of the line; none or null for a line with no photo.</param>
    /// <param name="delivery">Makes the addresses.</param>
    /// <returns>The slots.</returns>
    public static ProductLinePhotosDto ToAdminSlots(IReadOnlyList<ProductLinePhoto>? photos, IImageDelivery delivery)
    {
        if (photos is null || photos.Count == 0)
        {
            return ProductLinePhotosDto.None;
        }

        ProductLinePhotoDto? Slot(ProductLinePhotoSlot slot) =>
            photos.FirstOrDefault(photo => photo.Slot == slot) is { } found ? ToAdmin(found, delivery) : null;

        return new ProductLinePhotosDto(Slot(ProductLinePhotoSlot.Main), Slot(ProductLinePhotoSlot.Back), Slot(ProductLinePhotoSlot.Fabric));
    }

    /// <summary>Maps the 44 px thumb of a line's main photo for the Manager's list.</summary>
    /// <param name="photo">The main photo row; null when the line has none.</param>
    /// <param name="delivery">Makes the address.</param>
    /// <returns>The address, or null when there is no photo or the account has no cloud name set.</returns>
    public static string? ToThumb(ProductLinePhoto? photo, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        if (photo is null)
        {
            return null;
        }

        var thumb = delivery.ForLinePhoto(photo.PublicId, photo.Width, photo.Height).Thumb;
        return thumb.Length == 0 ? null : thumb;
    }

    /// <summary>Maps one photo for a visitor.</summary>
    /// <param name="photo">The photo row.</param>
    /// <param name="delivery">Makes the addresses.</param>
    /// <returns>The DTO, or null when the delivery has no address to give, so the page shows the drawing instead of a broken picture.</returns>
    public static PublicPhotoDto? ToPublic(ProductLinePhoto photo, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(photo);
        ArgumentNullException.ThrowIfNull(delivery);
        var urls = delivery.ForLinePhoto(photo.PublicId, photo.Width, photo.Height);
        var source = photo.Slot == ProductLinePhotoSlot.Main ? urls.Large : urls.Small;
        return source.Src.Length == 0 ? null : new PublicPhotoDto(source.Src, source.SrcSet, photo.Width, photo.Height);
    }
}
