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

    /// <summary>The message for a missing title.</summary>
    public const string TitleRequiredMessage = "Enter the title.";

    /// <summary>The message for a title over the limit.</summary>
    public const string TitleTooLongMessage = "Keep the title to 60 characters or fewer.";

    /// <summary>The message for a missing short name.</summary>
    public const string ShortNameRequiredMessage = "Enter a short name.";

    /// <summary>The message for a short name over the limit.</summary>
    public const string ShortNameTooLongMessage = "Keep the short name to 20 characters or fewer.";

    /// <summary>The message for a number that is not up to two letters or digits.</summary>
    public const string NumberInvalidMessage = "Use up to 2 letters or digits, like 23 or 3X.";

    /// <summary>The message for a missing card text.</summary>
    public const string CardTextRequiredMessage = "Enter the card text.";

    /// <summary>The message for a card text over the limit.</summary>
    public const string CardTextTooLongMessage = "Keep the card text to 140 characters or fewer.";

    /// <summary>The message for a missing description.</summary>
    public const string DescriptionRequiredMessage = "Enter the description.";

    /// <summary>The message for a description over the limit.</summary>
    public const string DescriptionTooLongMessage = "Keep the description to 300 characters or fewer.";

    /// <summary>The message for a "what you can customize" text over the limit.</summary>
    public const string CustomizeTooLongMessage = "Keep this to 120 characters or fewer.";

    /// <summary>The message for a price with more than two decimals.</summary>
    public const string PriceDecimalsMessage = "Use at most 2 decimal places.";

    /// <summary>The title of the Fabric card.</summary>
    public const string FabricLabel = "Fabric";

    /// <summary>The title of the Collar style card.</summary>
    public const string CollarLabel = "Collar style";

    /// <summary>The title of the Cut and fit card.</summary>
    public const string CutLabel = "Cut & fit";

    /// <summary>The title of the Names and numbers card.</summary>
    public const string NamesLabel = "Names & numbers";

    /// <summary>The title of the Logos and sponsors card.</summary>
    public const string LogosLabel = "Logos & sponsors";

    /// <summary>The message for a price below the lowest.</summary>
    public const string PriceTooLowMessage = "Enter a price of at least ₱0.01.";

    /// <summary>The message for a price above the highest.</summary>
    public const string PriceTooHighMessage = "Enter a price up to ₱999,999.99.";

    /// <summary>The message for a minimum order that is not a whole number from 1 to 9,999.</summary>
    public const string MinimumInvalidMessage = "Enter a whole number from 1 to 9,999.";

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

    /// <summary>
    /// Checks what a Manager typed against the rules, so the request validator and the domain never disagree. A text is judged after
    /// trimming. What needs the database (a short name another line already uses) is checked by the handlers under the site-content lock.
    /// </summary>
    /// <param name="values">What was typed.</param>
    /// <returns>The messages by field name; empty when all is fine.</returns>
    public static Dictionary<string, string[]> Check(ProductLineValues values)
    {
        ArgumentNullException.ThrowIfNull(values);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        CheckText(errors, "title", values.Title, TitleMaxLength, TitleRequiredMessage, TitleTooLongMessage);
        CheckText(errors, "shortName", values.ShortName, ShortNameMaxLength, ShortNameRequiredMessage, ShortNameTooLongMessage);
        if (!IsNumberOk(values.Number))
        {
            errors["number"] = [NumberInvalidMessage];
        }

        CheckText(errors, "cardText", values.CardText, CardTextMaxLength, CardTextRequiredMessage, CardTextTooLongMessage);
        CheckText(errors, "description", values.Description, DescriptionMaxLength, DescriptionRequiredMessage, DescriptionTooLongMessage);
        CheckText(errors, "fabricText", values.FabricText, CustomizeTextMaxLength, CustomizeRequiredMessage(FabricLabel), CustomizeTooLongMessage);
        CheckText(errors, "collarText", values.CollarText, CustomizeTextMaxLength, CustomizeRequiredMessage(CollarLabel), CustomizeTooLongMessage);
        CheckText(errors, "cutText", values.CutText, CustomizeTextMaxLength, CustomizeRequiredMessage(CutLabel), CustomizeTooLongMessage);
        CheckText(errors, "namesText", values.NamesText, CustomizeTextMaxLength, CustomizeRequiredMessage(NamesLabel), CustomizeTooLongMessage);
        CheckText(errors, "logosText", values.LogosText, CustomizeTextMaxLength, CustomizeRequiredMessage(LogosLabel), CustomizeTooLongMessage);

        if (values.StartsAtPrice is { } price)
        {
            if (decimal.Round(price, 2) != price)
            {
                errors["startsAtPrice"] = [PriceDecimalsMessage];
            }
            else if (price < MinPrice)
            {
                errors["startsAtPrice"] = [PriceTooLowMessage];
            }
            else if (price > MaxPrice)
            {
                errors["startsAtPrice"] = [PriceTooHighMessage];
            }
        }

        if (values.MinimumQuantity is { } minimum && (minimum != decimal.Truncate(minimum) || minimum < MinQuantity || minimum > MaxQuantity))
        {
            errors["minimumQuantity"] = [MinimumInvalidMessage];
        }

        return errors;
    }

    /// <summary>Writes the message for a missing "what you can customize" text, naming its card.</summary>
    /// <param name="label">The card title, such as "Fabric".</param>
    /// <returns>The message.</returns>
    public static string CustomizeRequiredMessage(string label) => string.Concat("Enter the ", label, " text.");

    /// <summary>Builds a new line from what a Manager typed. It gets the custom drawing and no photos.</summary>
    /// <param name="values">What was typed; the line is hidden unless <see cref="ProductLineValues.IsActive"/> is true.</param>
    /// <param name="key">The key made from the short name by <see cref="LineKey.From"/>; it never changes.</param>
    /// <param name="position">The place in the order, from 1.</param>
    /// <param name="now">The current instant, which makes the id.</param>
    /// <returns>The new, unsaved line, or a validation error naming the broken fields.</returns>
    public static Result<ProductLine> Create(ProductLineValues values, string key, int position, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(values);
        if (!LineKey.IsValid(key))
        {
            throw new ArgumentException("The key is not a well-formed line key.", nameof(key));
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(position, 1);

        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<ProductLine>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var line = new ProductLine(Guid.CreateVersion7(now), now)
        {
            Key = key,
            Position = position,
            IsActive = values.IsActive ?? false,
            PlaceholderArt = PlaceholderArt.Custom,
        };
        line.Apply(values);
        return Result.Success(line);
    }

    /// <summary>Changes the line to what a Manager typed. The key never changes. A failure changes nothing.</summary>
    /// <param name="values">What was typed; a null <see cref="ProductLineValues.IsActive"/> keeps the line shown or hidden as it is.</param>
    /// <returns>What changed (nothing when the form holds the same values), or a validation error naming the broken fields.</returns>
    public Result<ProductLineChanges> Update(ProductLineValues values)
    {
        ArgumentNullException.ThrowIfNull(values);
        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<ProductLineChanges>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var before = (Title, ShortName, StartsAtPrice, MinimumQuantity);
        var fields = Apply(values);
        bool? nowShown = null;
        if (values.IsActive is { } active && active != IsActive)
        {
            IsActive = active;
            nowShown = active;
        }

        return Result.Success(new ProductLineChanges(fields, before.Title, Title, before.ShortName, ShortName, before.StartsAtPrice, StartsAtPrice, before.MinimumQuantity, MinimumQuantity, nowShown));
    }

    /// <summary>Takes the line off the website.</summary>
    /// <returns>True when it was shown and is now hidden.</returns>
    public bool Hide()
    {
        var changed = IsActive;
        IsActive = false;
        return changed;
    }

    /// <summary>Puts the line on the website.</summary>
    /// <returns>True when it was hidden and is now shown.</returns>
    public bool Show()
    {
        var changed = !IsActive;
        IsActive = true;
        return changed;
    }

    /// <summary>Trades places in the order with another line.</summary>
    /// <param name="other">The other line.</param>
    public void SwapPositionWith(ProductLine other)
    {
        ArgumentNullException.ThrowIfNull(other);
        (Position, other.Position) = (other.Position, Position);
    }

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

    // A text is required, and at most max characters after trimming.
    private static void CheckText(Dictionary<string, string[]> errors, string field, string? text, int max, string required, string tooLong)
    {
        var length = text?.Trim().Length ?? 0;
        if (length == 0)
        {
            errors[field] = [required];
        }
        else if (length > max)
        {
            errors[field] = [tooLong];
        }
    }

    // The number is optional: up to two ASCII letters or digits, so it always draws on the jersey.
    private static bool IsNumberOk(string? number)
    {
        var trimmed = number?.Trim() ?? string.Empty;
        return trimmed.Length <= NumberMaxLength && trimmed.All(char.IsAsciiLetterOrDigit);
    }

    private static bool Differs(string current, string? typed, out string next)
    {
        next = typed?.Trim() ?? string.Empty;
        return !string.Equals(current, next, StringComparison.Ordinal);
    }

    // Sets every typed value and names the fields that were different, in form order.
    private List<string> Apply(ProductLineValues values)
    {
        var fields = new List<string>();
        if (Differs(Title, values.Title, out var title))
        {
            Title = title;
            fields.Add("title");
        }

        if (Differs(ShortName, values.ShortName, out var shortName))
        {
            ShortName = shortName;
            fields.Add("shortName");
        }

        if (Differs(Number, values.Number, out var number))
        {
            Number = number;
            fields.Add("number");
        }

        if (Differs(CardText, values.CardText, out var cardText))
        {
            CardText = cardText;
            fields.Add("cardText");
        }

        if (Differs(Description, values.Description, out var description))
        {
            Description = description;
            fields.Add("description");
        }

        if (Differs(FabricText, values.FabricText, out var fabric))
        {
            FabricText = fabric;
            fields.Add("fabricText");
        }

        if (Differs(CollarText, values.CollarText, out var collar))
        {
            CollarText = collar;
            fields.Add("collarText");
        }

        if (Differs(CutText, values.CutText, out var cut))
        {
            CutText = cut;
            fields.Add("cutText");
        }

        if (Differs(NamesText, values.NamesText, out var names))
        {
            NamesText = names;
            fields.Add("namesText");
        }

        if (Differs(LogosText, values.LogosText, out var logos))
        {
            LogosText = logos;
            fields.Add("logosText");
        }

        if (values.StartsAtPrice != StartsAtPrice)
        {
            StartsAtPrice = values.StartsAtPrice;
            fields.Add("startsAtPrice");
        }

        int? minimum = values.MinimumQuantity is { } typedMinimum ? (int)typedMinimum : null;
        if (minimum != MinimumQuantity)
        {
            MinimumQuantity = minimum;
            fields.Add("minimumQuantity");
        }

        return fields;
    }
}
