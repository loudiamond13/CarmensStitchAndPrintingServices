using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>One photo of a product line, as the public page draws it.</summary>
/// <param name="Src">The address of the photo at its largest size.</param>
/// <param name="SrcSet">The <c>srcset</c> text with the smaller sizes.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
public sealed record PublicPhotoDto(string Src, string SrcSet, int Width, int Height);

/// <summary>The three photo slots of a product line; a slot with no photo is null and the page shows the drawing.</summary>
/// <param name="Main">The main photo.</param>
/// <param name="Back">The back view.</param>
/// <param name="Fabric">The fabric detail.</param>
public sealed record PublicLinePhotosDto(PublicPhotoDto? Main, PublicPhotoDto? Back, PublicPhotoDto? Fabric);

/// <summary>The five "what you can customize" texts of a product line, always in this order on the page.</summary>
/// <param name="Fabric">What the Fabric card says.</param>
/// <param name="Collar">What the Collar style card says.</param>
/// <param name="Cut">What the Cut and fit card says.</param>
/// <param name="Names">What the Names and numbers card says.</param>
/// <param name="Logos">What the Logos and sponsors card says.</param>
public sealed record PublicCustomizeDto(string Fabric, string Collar, string Cut, string Names, string Logos);

/// <summary>One product line a visitor sees (PUB-02).</summary>
/// <param name="Key">The key the page anchors and gallery filters use, such as "basketball".</param>
/// <param name="Number">The number drawn on the jersey and the empty photo boxes, such as "23".</param>
/// <param name="Title">The title, such as "Basketball Jerseys".</param>
/// <param name="ShortName">The short name, such as "Basketball".</param>
/// <param name="CardText">The Home card text.</param>
/// <param name="Description">The Products page description.</param>
/// <param name="Customize">The five "what you can customize" texts.</param>
/// <param name="StartsAtPrice">The starting price per piece in pesos; null means "Message us for a price".</param>
/// <param name="MinimumQuantity">The minimum order in pieces; null when there is none.</param>
/// <param name="PlaceholderArt">The drawing shown until there are photos: <c>basketball</c>, <c>volleyball</c>, <c>moto</c>, <c>longSleeves</c>, <c>polo</c> or <c>custom</c>.</param>
/// <param name="Photos">The photos; each slot is null until a Manager adds one.</param>
/// <param name="HasGalleryItems">True when the Gallery has a photo under this line, so "See {short name} work" has something to show.</param>
public sealed record PublicProductLineDto(
    string Key,
    string Number,
    string Title,
    string ShortName,
    string CardText,
    string Description,
    PublicCustomizeDto Customize,
    decimal? StartsAtPrice,
    int? MinimumQuantity,
    string PlaceholderArt,
    PublicLinePhotosDto Photos,
    bool HasGalleryItems);

/// <summary>The shown product lines in display order; empty when the Manager has hidden all of them (CONT-02).</summary>
/// <param name="Lines">The lines.</param>
public sealed record PublicProductLinesDto(IReadOnlyList<PublicProductLineDto> Lines);

/// <summary>The product lines as one cached value: the typed data and the JSON the API and the boot data block send.</summary>
/// <param name="Lines">The typed data.</param>
/// <param name="Json">The same data as JSON with its ETag.</param>
/// <param name="ShareImageUrl">
/// The 1200 x 630 link preview address of the first shown line's main photo, for the Products page head; null when that line has no main
/// photo (D-26). It is not part of the JSON the page reads.
/// </param>
[ImmutableObject(true)]
public sealed record PublicProductLinesSnapshot(PublicProductLinesDto Lines, PublicJsonSnapshot Json, string? ShareImageUrl = null);
