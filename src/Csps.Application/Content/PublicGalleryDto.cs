using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>One photo of a gallery item, with the addresses of each place the Gallery draws it (D-12, D-30).</summary>
/// <param name="Src">The masonry tile address, at the largest masonry size that fits the photo.</param>
/// <param name="SrcSet">The masonry <c>srcset</c> text with the smaller sizes.</param>
/// <param name="ViewerSrc">The lightbox address, the whole photo at the middle viewer size.</param>
/// <param name="ViewerSrcSet">The lightbox <c>srcset</c> text.</param>
/// <param name="ThumbSrc">The address of the square lightbox thumb.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
public sealed record PublicGalleryPhotoDto(string Src, string SrcSet, string ViewerSrc, string ViewerSrcSet, string ThumbSrc, int Width, int Height);

/// <summary>
/// One tile of the Gallery (D-10): an order with all its photos, or one uploaded photo. It holds public text only (D-13): the name shown, the
/// line, the pieces and, for an upload, the note. It never holds a customer's name, phone, email or address, a price, an order note or a
/// photo description.
/// </summary>
/// <param name="Id">The id of the gallery entry, stable for the life of the tile.</param>
/// <param name="Team">The name shown: the public name when staff typed one, else the team.</param>
/// <param name="LineKey">The key of the line the item is filed under, such as "basketball".</param>
/// <param name="LineShortName">The short name of that line, such as "Basketball".</param>
/// <param name="Pieces">How many pieces; null for an upload that gives none.</param>
/// <param name="Note">The note of an upload; null for an order and for an upload with none.</param>
/// <param name="PlaceholderArt">The drawing shown when no photo address is available: <c>basketball</c>, <c>volleyball</c>, <c>moto</c>, <c>longSleeves</c>, <c>polo</c> or <c>custom</c>.</param>
/// <param name="Photos">The photos in display order, the cover first.</param>
public sealed record PublicGalleryItemDto(
    Guid Id,
    string Team,
    string LineKey,
    string LineShortName,
    int? Pieces,
    string? Note,
    string PlaceholderArt,
    IReadOnlyList<PublicGalleryPhotoDto> Photos);

/// <summary>One category pill of the Gallery: a shown line that has at least one public item.</summary>
/// <param name="Key">The line key, which the page writes to the address.</param>
/// <param name="ShortName">The short name on the pill.</param>
/// <param name="Count">How many public items are filed under the line.</param>
public sealed record PublicGalleryPillDto(string Key, string ShortName, int Count);

/// <summary>Everything the Gallery draws, in one read (GAL-01, D-10): every public item in gallery order, the pills in display order and the total.</summary>
/// <param name="Items">The public items in gallery order.</param>
/// <param name="Pills">One pill for each shown line that has at least one item, in display order.</param>
/// <param name="Total">The number of items.</param>
public sealed record PublicGalleryDto(IReadOnlyList<PublicGalleryItemDto> Items, IReadOnlyList<PublicGalleryPillDto> Pills, int Total);

/// <summary>The Gallery data as one cached value: the typed data and the JSON the API sends.</summary>
/// <param name="Gallery">The typed data.</param>
/// <param name="Json">The same data as JSON with its ETag.</param>
/// <param name="ShareImageUrl">
/// The 1200 x 630 link preview address of the cover photo of the item at the top of the gallery, for the Gallery page head; null when there
/// is no public photo or the delivery has no address (D-26). It is not part of the JSON the page reads.
/// </param>
[ImmutableObject(true)]
public sealed record PublicGallerySnapshot(PublicGalleryDto Gallery, PublicJsonSnapshot Json, string? ShareImageUrl = null);
