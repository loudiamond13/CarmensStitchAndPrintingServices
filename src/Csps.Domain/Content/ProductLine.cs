using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// A product line the public Home and Products pages show (D-01, CONT-02): its names, words, the five "what you can customize" texts, an
/// optional starting price and minimum order, its place in the list, whether it is shown, and the drawing used until it has photos.
/// There are no per-line price items (D-34). Who created and changed it, and when, are set only by the database layer (SEC-08). The six
/// starting lines come from the migration (D-06). A saved change clears the public cache (PUB-03).
/// </summary>
public sealed class ProductLine : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The longest key.</summary>
    public const int KeyMaxLength = 40;

    /// <summary>The longest title.</summary>
    public const int TitleMaxLength = 60;

    /// <summary>The longest short name.</summary>
    public const int ShortNameMaxLength = 20;

    /// <summary>The longest number on the drawing.</summary>
    public const int NumberMaxLength = 2;

    /// <summary>The longest Home card text.</summary>
    public const int CardTextMaxLength = 140;

    /// <summary>The longest Products page description.</summary>
    public const int DescriptionMaxLength = 300;

    /// <summary>The longest text of one "what you can customize" card.</summary>
    public const int CustomizeTextMaxLength = 120;

    /// <summary>The lowest starting price.</summary>
    public static readonly decimal MinPrice = 0.01m;

    /// <summary>The highest starting price.</summary>
    public static readonly decimal MaxPrice = 999_999.99m;

    /// <summary>The lowest minimum order, in pieces.</summary>
    public const int MinQuantity = 1;

    /// <summary>The highest minimum order, in pieces.</summary>
    public const int MaxQuantity = 9_999;

    // Used by EF Core (constructor binding) and by FromSeed.
    private ProductLine(Guid id, DateTimeOffset createdAtUtc)
    {
        Id = id;
        CreatedAtUtc = createdAtUtc;
        RowVersion = [];
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The key the page anchors and gallery filters use; unique.</summary>
    public string Key { get; private set; } = string.Empty;

    /// <summary>The title.</summary>
    public string Title { get; private set; } = string.Empty;

    /// <summary>The short name the gallery filters and buttons use; unique.</summary>
    public string ShortName { get; private set; } = string.Empty;

    /// <summary>The number drawn on the jersey and the empty photo boxes.</summary>
    public string Number { get; private set; } = string.Empty;

    /// <summary>The Home card text.</summary>
    public string CardText { get; private set; } = string.Empty;

    /// <summary>The Products page description.</summary>
    public string Description { get; private set; } = string.Empty;

    /// <summary>What the Fabric card says.</summary>
    public string FabricText { get; private set; } = string.Empty;

    /// <summary>What the Collar style card says.</summary>
    public string CollarText { get; private set; } = string.Empty;

    /// <summary>What the Cut and fit card says.</summary>
    public string CutText { get; private set; } = string.Empty;

    /// <summary>What the Names and numbers card says.</summary>
    public string NamesText { get; private set; } = string.Empty;

    /// <summary>What the Logos and sponsors card says.</summary>
    public string LogosText { get; private set; } = string.Empty;

    /// <summary>The starting price per piece; null shows "Message us for a price" (D-04).</summary>
    public decimal? StartsAtPrice { get; private set; }

    /// <summary>The minimum order in pieces; null shows none.</summary>
    public int? MinimumQuantity { get; private set; }

    /// <summary>The display order, from 1.</summary>
    public int Position { get; private set; }

    /// <summary>True while the line shows on the website.</summary>
    public bool IsActive { get; private set; }

    /// <summary>The drawing shown until the line has photos.</summary>
    public PlaceholderArt PlaceholderArt { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Builds a line from a seeded entry, shown, with the given price and minimum, for the Testing seeder and tests.</summary>
    /// <param name="entry">The seeded entry.</param>
    /// <param name="startsAtPrice">The starting price; null for none.</param>
    /// <param name="minimumQuantity">The minimum order; null for none.</param>
    /// <param name="now">The creation instant.</param>
    /// <returns>The new, unsaved line.</returns>
    public static ProductLine FromSeed(ProductLineSeedEntry entry, decimal? startsAtPrice, int? minimumQuantity, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(entry);
        var line = new ProductLine(entry.Id, now);
        line.ResetToSeed(entry, startsAtPrice, minimumQuantity);
        return line;
    }

    /// <summary>
    /// Puts every value back to the seeded entry's, shown, with the given price and minimum. It is for seeding only (the Testing seeder);
    /// the Manager's own edits come through their own methods. Saving an unchanged line writes nothing, so a repeat leaves the row alone.
    /// </summary>
    /// <param name="entry">The seeded entry.</param>
    /// <param name="startsAtPrice">The starting price; null for none.</param>
    /// <param name="minimumQuantity">The minimum order; null for none.</param>
    public void ResetToSeed(ProductLineSeedEntry entry, decimal? startsAtPrice, int? minimumQuantity)
    {
        ArgumentNullException.ThrowIfNull(entry);
        Key = entry.Key;
        Title = entry.Title;
        ShortName = entry.ShortName;
        Number = entry.Number;
        CardText = entry.CardText;
        Description = entry.Description;
        FabricText = entry.FabricText;
        CollarText = entry.CollarText;
        CutText = entry.CutText;
        NamesText = entry.NamesText;
        LogosText = entry.LogosText;
        StartsAtPrice = startsAtPrice;
        MinimumQuantity = minimumQuantity;
        Position = entry.Position;
        IsActive = true;
        PlaceholderArt = entry.PlaceholderArt;
    }
}
