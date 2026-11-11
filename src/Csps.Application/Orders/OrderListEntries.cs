using Csps.Application.Ports;

namespace Csps.Application.Orders;

/// <summary>Shapes a stored order list row for the wire. The order list and the dashboard's newest orders share it, so both show the same entry.</summary>
public static class OrderListEntries
{
    /// <summary>Maps one row: the status becomes its key and the cover photo becomes its addresses.</summary>
    /// <param name="row">The stored row.</param>
    /// <param name="imageDelivery">Builds the cover addresses at read time; they are never stored.</param>
    /// <returns>The entry.</returns>
    public static OrderListEntry From(OrderListRow row, IImageDelivery imageDelivery)
    {
        ArgumentNullException.ThrowIfNull(row);
        ArgumentNullException.ThrowIfNull(imageDelivery);

        return new OrderListEntry(
            row.Id,
            row.Number,
            row.CustomerName,
            row.TeamName,
            row.OrderDate,
            row.DueDate,
            OrderStatusNames.ToKey(row.Status),
            row.StatusChangedAtUtc,
            row.Subtotal,
            row.Discount,
            row.Total,
            row.Paid,
            row.Refunded,
            row.Balance,
            row.CustomerCredit,
            row.FullyPaid,
            row.Pieces,
            row.ImageCount,
            CoverOf(row, imageDelivery));
    }

    // An order with no photo has no cover.
    private static OrderCoverResponse? CoverOf(OrderListRow row, IImageDelivery imageDelivery)
    {
        if (row.CoverPublicId is not { } publicId || row.CoverWidth is not { } width || row.CoverHeight is not { } height)
        {
            return null;
        }

        var urls = imageDelivery.ForCover(publicId, width, height);
        return new OrderCoverResponse(
            new ImageSourceResponse(urls.Card.Src, urls.Card.SrcSet),
            new ImageSourceResponse(urls.Table.Src, urls.Table.SrcSet),
            width,
            height);
    }
}
