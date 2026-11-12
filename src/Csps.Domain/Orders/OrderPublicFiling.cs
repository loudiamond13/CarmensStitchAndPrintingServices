namespace Csps.Domain.Orders;

/// <summary>One order item as the filing rules need it: the line its product type is filed under, and how many.</summary>
/// <param name="ProductLineId">The product line the item's product type is filed under; null when it is filed under none.</param>
/// <param name="Quantity">How many pieces.</param>
public sealed record PublicFilingItem(Guid? ProductLineId, int Quantity);

/// <summary>
/// The pure rules that say how an order is filed on the public site (D-09, D-13): the pieces are the sum of the item quantities, and the
/// auto line is the line with the most pieces. Nothing here reads a database.
/// </summary>
public static class OrderPublicFiling
{
    /// <summary>Adds up the pieces of every item, whatever line it is filed under.</summary>
    /// <param name="items">The order's items.</param>
    /// <returns>The sum of the quantities.</returns>
    public static int Pieces(IEnumerable<PublicFilingItem> items)
    {
        ArgumentNullException.ThrowIfNull(items);
        return items.Sum(static item => item.Quantity);
    }

    /// <summary>
    /// Finds the line with the most pieces. A tie goes to the line that comes first in the display order. Items filed under no line count
    /// for nothing.
    /// </summary>
    /// <param name="items">The order's items.</param>
    /// <param name="lineOrder">The ids of the lines in display order.</param>
    /// <returns>The auto line, or null when no item is filed under a line.</returns>
    public static Guid? AutoLine(IEnumerable<PublicFilingItem> items, IReadOnlyList<Guid> lineOrder)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(lineOrder);

        var positions = new Dictionary<Guid, int>();
        for (var index = 0; index < lineOrder.Count; index++)
        {
            positions.TryAdd(lineOrder[index], index);
        }

        return items
            .Where(static item => item.ProductLineId is not null)
            .GroupBy(static item => item.ProductLineId!.Value)
            .Select(group => (Line: group.Key, Pieces: group.Sum(static item => item.Quantity)))
            .OrderByDescending(static entry => entry.Pieces)
            .ThenBy(entry => positions.GetValueOrDefault(entry.Line, int.MaxValue))
            .Select(static entry => (Guid?)entry.Line)
            .FirstOrDefault();
    }
}
