using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>product-line.*</c> and <c>product-type.line-linked</c> audit entries (AUDIT-01). A change names every
/// changed field in a <c>fields=</c> pair and then holds <c>key=old&gt;new</c> for the short values: title, short name, price and minimum
/// (an empty side means none). The long texts are named and never copied. A pair that would push the detail past
/// <see cref="AuditEntry.DetailMaxLength"/> is left out, so the entry is always written.
/// </summary>
public static class ProductLineAuditDetail
{
    /// <summary>The target type of every product line audit entry.</summary>
    public const string TargetType = "ProductLine";

    /// <summary>The target type of a product type link audit entry.</summary>
    public const string LinkTargetType = "ProductType";

    /// <summary>The change word of a photo put in an empty slot.</summary>
    public const string PhotoAdded = "added";

    /// <summary>The change word of a photo put in the place of another.</summary>
    public const string PhotoReplaced = "replaced";

    /// <summary>The change word of a photo taken out of its slot.</summary>
    public const string PhotoRemoved = "removed";

    private const char PairSeparator = ';';
    private const char FieldSeparator = ',';

    /// <summary>Writes the detail of an added, hidden, shown or deleted line: its key and title.</summary>
    /// <param name="line">The line.</param>
    /// <returns>The detail text.</returns>
    public static string Named(ProductLine line)
    {
        ArgumentNullException.ThrowIfNull(line);
        return AuditDetailFormat.Join(AuditDetailFormat.Pair("key", line.Key), AuditDetailFormat.Pair("title", line.Title));
    }

    /// <summary>Writes the detail of a changed line.</summary>
    /// <param name="change">What changed.</param>
    /// <returns>The detail text.</returns>
    public static string Changed(ProductLineChanges change)
    {
        ArgumentNullException.ThrowIfNull(change);

        var detail = AuditDetailFormat.Pair("fields", string.Join(FieldSeparator, change.Fields));
        var pairs = new List<string>();
        if (change.Fields.Contains("title"))
        {
            pairs.Add(AuditDetailFormat.Change("title", change.OldTitle, change.NewTitle));
        }

        if (change.Fields.Contains("shortName"))
        {
            pairs.Add(AuditDetailFormat.Change("shortName", change.OldShortName, change.NewShortName));
        }

        if (change.Fields.Contains("startsAtPrice"))
        {
            pairs.Add(AuditDetailFormat.Change("price", Price(change.OldPrice), Price(change.NewPrice)));
        }

        if (change.Fields.Contains("minimumQuantity"))
        {
            pairs.Add(AuditDetailFormat.Change("minimum", Quantity(change.OldMinimum), Quantity(change.NewMinimum)));
        }

        foreach (var pair in pairs.Where(pair => detail.Length + 1 + pair.Length <= AuditEntry.DetailMaxLength))
        {
            detail = string.Concat(detail, PairSeparator, pair);
        }

        return detail;
    }

    /// <summary>Writes the detail of a move: the title and the old and new place.</summary>
    /// <param name="line">The line that moved.</param>
    /// <param name="oldPosition">The place before.</param>
    /// <returns>The detail text.</returns>
    public static string Moved(ProductLine line, int oldPosition)
    {
        ArgumentNullException.ThrowIfNull(line);
        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("title", line.Title),
            AuditDetailFormat.Change("position", Quantity(oldPosition), Quantity(line.Position)));
    }

    /// <summary>Writes the detail of a photo that was added, replaced or removed: the line, the slot and the change, never the address.</summary>
    /// <param name="line">The line.</param>
    /// <param name="slot">The slot.</param>
    /// <param name="change">One of <see cref="PhotoAdded"/>, <see cref="PhotoReplaced"/> or <see cref="PhotoRemoved"/>.</param>
    /// <returns>The detail text.</returns>
    public static string PhotoChanged(ProductLine line, ProductLinePhotoSlot slot, string change)
    {
        ArgumentNullException.ThrowIfNull(line);
        ArgumentNullException.ThrowIfNull(change);
        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("key", line.Key),
            AuditDetailFormat.Pair("title", line.Title),
            AuditDetailFormat.Pair("slot", ProductLinePhotoSlots.ToText(slot)),
            AuditDetailFormat.Pair("change", change));
    }

    /// <summary>Writes the detail of a product type that was filed under another line or none.</summary>
    /// <param name="oldLineTitle">The title of the line it was under; null when it was under none.</param>
    /// <param name="newLineTitle">The title of the line it is under now; null when it is under none.</param>
    /// <returns>The detail text.</returns>
    public static string Linked(string? oldLineTitle, string? newLineTitle) =>
        AuditDetailFormat.Join(AuditDetailFormat.Change("line", oldLineTitle ?? string.Empty, newLineTitle ?? string.Empty));

    private static string Price(decimal? price) => price?.ToString("0.00", CultureInfo.InvariantCulture) ?? string.Empty;

    private static string Quantity(int? quantity) => quantity?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
}
