using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One row of the Manager's product line list (CONT-02): what the Products tab shows and what its actions need.</summary>
/// <param name="Id">The line id.</param>
/// <param name="Key">The URL key.</param>
/// <param name="Title">The title.</param>
/// <param name="ShortName">The short name.</param>
/// <param name="StartsAtPrice">The starting price; null for none.</param>
/// <param name="MinimumQuantity">The minimum order; null for none.</param>
/// <param name="IsActive">True while the line shows on the website.</param>
/// <param name="Position">The place in the order, from 1.</param>
/// <param name="MainPhotoThumb">The small main photo; null until the line has one.</param>
/// <param name="ProductTypeIds">The order product types filed under the line, A to Z.</param>
/// <param name="ShownGalleryCount">How many public gallery items a visitor sees under the line.</param>
/// <param name="PhotoCount">How many photos the line has.</param>
/// <param name="CanDelete">True when nothing is filed under the line, so Delete is offered.</param>
/// <param name="Version">The text an edit must send back.</param>
public sealed record ProductLineListItemDto(
    Guid Id,
    string Key,
    string Title,
    string ShortName,
    decimal? StartsAtPrice,
    int? MinimumQuantity,
    bool IsActive,
    int Position,
    string? MainPhotoThumb,
    IReadOnlyList<Guid> ProductTypeIds,
    int ShownGalleryCount,
    int PhotoCount,
    bool CanDelete,
    string Version)
{
    /// <summary>Maps a list row to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="row">The row.</param>
    /// <param name="delivery">Makes the address of the main photo thumb.</param>
    /// <returns>The DTO.</returns>
    public static ProductLineListItemDto From(ProductLineListRow row, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(row);
        var line = row.Line;
        return new ProductLineListItemDto(
            line.Id,
            line.Key,
            line.Title,
            line.ShortName,
            line.StartsAtPrice,
            line.MinimumQuantity,
            line.IsActive,
            line.Position,
            ProductLinePhotoMapper.ToThumb(row.MainPhoto, delivery),
            row.ProductTypeIds,
            row.ShownGalleryCount,
            row.PhotoCount,
            row.PhotoCount == 0 && row.GalleryItemCount == 0 && row.ProductTypeIds.Count == 0,
            RowVersions.ToText(line.RowVersion));
    }
}

/// <summary>One product line with every field, for the editor (CONT-02).</summary>
/// <param name="Id">The line id.</param>
/// <param name="Key">The URL key; it never changes.</param>
/// <param name="Title">The title.</param>
/// <param name="ShortName">The short name.</param>
/// <param name="Number">The number on the drawing; empty for none.</param>
/// <param name="CardText">The Home card text.</param>
/// <param name="Description">The Products page description.</param>
/// <param name="FabricText">What the Fabric card says.</param>
/// <param name="CollarText">What the Collar style card says.</param>
/// <param name="CutText">What the Cut and fit card says.</param>
/// <param name="NamesText">What the Names and numbers card says.</param>
/// <param name="LogosText">What the Logos and sponsors card says.</param>
/// <param name="StartsAtPrice">The starting price; null for none.</param>
/// <param name="MinimumQuantity">The minimum order; null for none.</param>
/// <param name="IsActive">True while the line shows on the website.</param>
/// <param name="Position">The place in the order, from 1.</param>
/// <param name="PlaceholderArt">The drawing shown until there are photos: <c>basketball</c>, <c>volleyball</c>, <c>moto</c>, <c>longSleeves</c>, <c>polo</c> or <c>custom</c>.</param>
/// <param name="ProductTypeIds">The order product types filed under the line, A to Z.</param>
/// <param name="Photos">The photos of the three slots; a slot with no photo is null.</param>
/// <param name="Version">The text an edit must send back.</param>
/// <param name="UpdatedByName">The name of the person who last changed the line; null when no person did.</param>
/// <param name="CreatedAtUtc">When the line was added.</param>
/// <param name="UpdatedAtUtc">When the line was last changed; null until a change.</param>
public sealed record ProductLineDetailDto(
    Guid Id,
    string Key,
    string Title,
    string ShortName,
    string Number,
    string CardText,
    string Description,
    string FabricText,
    string CollarText,
    string CutText,
    string NamesText,
    string LogosText,
    decimal? StartsAtPrice,
    int? MinimumQuantity,
    bool IsActive,
    int Position,
    string PlaceholderArt,
    IReadOnlyList<Guid> ProductTypeIds,
    ProductLinePhotosDto Photos,
    string Version,
    string? UpdatedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc)
{
    /// <summary>Maps a detail row to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="row">The row.</param>
    /// <param name="delivery">Makes the photo addresses.</param>
    /// <returns>The DTO.</returns>
    public static ProductLineDetailDto From(ProductLineDetailRow row, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(row);
        var line = row.Line;
        var art = line.PlaceholderArt.ToString();
        return new ProductLineDetailDto(
            line.Id,
            line.Key,
            line.Title,
            line.ShortName,
            line.Number,
            line.CardText,
            line.Description,
            line.FabricText,
            line.CollarText,
            line.CutText,
            line.NamesText,
            line.LogosText,
            line.StartsAtPrice,
            line.MinimumQuantity,
            line.IsActive,
            line.Position,
            string.Concat(char.ToLowerInvariant(art[0]).ToString(), art.AsSpan(1)),
            row.ProductTypeIds,
            ProductLinePhotoMapper.ToAdminSlots(row.Photos, delivery),
            RowVersions.ToText(line.RowVersion),
            row.UpdatedByName,
            line.CreatedAtUtc,
            line.UpdatedAtUtc);
    }
}
