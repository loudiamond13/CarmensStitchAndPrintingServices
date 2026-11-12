using Csps.Domain.Content;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>One photo of a public gallery item: the stored id and size, never an address.</summary>
/// <param name="PublicId">The stored public id.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
internal sealed record PublicGalleryPhotoRow(string PublicId, int Width, int Height);

/// <summary>One public gallery item with the D-13 fields only: the name shown, the line, the pieces, the note of an upload and the photos.</summary>
/// <param name="Id">The gallery entry id.</param>
/// <param name="Position">The place in the gallery order.</param>
/// <param name="Kind">An order or an upload.</param>
/// <param name="Team">The name shown.</param>
/// <param name="LineId">The line the item is filed under.</param>
/// <param name="LineKey">The line key.</param>
/// <param name="LineShortName">The line short name.</param>
/// <param name="Art">The line's placeholder drawing, as the page names it.</param>
/// <param name="Pieces">The pieces; null for an upload that gives none.</param>
/// <param name="Note">The note of an upload.</param>
/// <param name="ShownSinceUtc">When an order was put on the website; null for an upload.</param>
/// <param name="ChangedAtUtc">The newest stamp of the entry, its order and its line.</param>
/// <param name="Photos">The photos in display order, the cover first; never empty.</param>
internal sealed record PublicGalleryRow(
    Guid Id,
    int Position,
    GalleryEntryKind Kind,
    string Team,
    Guid LineId,
    string LineKey,
    string LineShortName,
    string Art,
    int? Pieces,
    string? Note,
    DateTimeOffset? ShownSinceUtc,
    DateTimeOffset ChangedAtUtc,
    IReadOnlyList<PublicGalleryPhotoRow> Photos);

/// <summary>One shown line, for the pills, in display order.</summary>
/// <param name="Id">The line id.</param>
/// <param name="Key">The line key.</param>
/// <param name="ShortName">The short name.</param>
internal sealed record PublicGalleryLineRow(Guid Id, string Key, string ShortName);

/// <summary>Everything the public gallery shows: the items in gallery order and the shown lines in display order.</summary>
/// <param name="Items">The public items.</param>
/// <param name="ShownLines">The shown lines.</param>
internal sealed record PublicGalleryRead(IReadOnlyList<PublicGalleryRow> Items, IReadOnlyList<PublicGalleryLineRow> ShownLines);

/// <summary>
/// The one projection of what the public may see of the gallery (GAL-01, D-10 to D-15, D-30, D-38). The gallery read, Home's Recent work and
/// the product lines' gallery flag all come from it, so no public answer decides on its own what is public. An order item is public with the
/// customer's recorded OK, a shown date, a status other than Cancelled, no delete mark, a shown line and at least one photo; an upload is
/// public when it is shown, has its photo and its line is shown. Every query lists its columns: nothing about the customer, no price and no
/// text of the order is ever selected (D-13).
/// </summary>
internal static class PublicGalleryProjection
{
    /// <summary>How many times the read is tried when SQL Server picks it as the loser of a deadlock with a writer.</summary>
    internal const int ReadAttempts = 3;

    /// <summary>
    /// Reads the public items in gallery order (the entry position, then the entry id) and the shown lines. The read is several queries
    /// over the tables a staff write changes, so it can lose a deadlock to that write. It changes nothing, so it is read again, up to
    /// <see cref="ReadAttempts"/> times, and a visitor never meets a 500 for it.
    /// </summary>
    /// <param name="db">The context to read with.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The public items and the shown lines.</returns>
    public static async Task<PublicGalleryRead> LoadAsync(CspsDbContext db, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await ReadAsync(db, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception error) when (attempt < ReadAttempts && SqlErrors.Has(error, SqlErrors.DeadlockVictim))
            {
                // The server rolled the statement back; the next attempt starts clean.
            }
        }
    }

    private static async Task<PublicGalleryRead> ReadAsync(CspsDbContext db, CancellationToken cancellationToken)
    {

        // The lines in display order give the auto line its tie break; the shown ones carry the pills.
        var lines = await db.ProductLines
            .AsNoTracking()
            .OrderBy(line => line.Position)
            .ThenBy(line => line.Id)
            .Select(line => new LineRow(line.Id, line.Key, line.ShortName, line.PlaceholderArt, line.IsActive, line.UpdatedAtUtc ?? line.CreatedAtUtc))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var lineOrder = lines.ConvertAll(line => line.Id);
        var shown = lines.Where(line => line.IsActive).ToDictionary(line => line.Id);

        // The join to Orders applies the soft-delete filter, so a deleted order is never public. A cancelled order has its shown date
        // cleared, and the status check stays as a second guard.
        var orderEntries = await (
            from entry in db.GalleryEntries.AsNoTracking()
            where entry.Kind == GalleryEntryKind.Order && entry.IsShown
            join order in db.Orders.AsNoTracking() on entry.OrderId equals (Guid?)order.Id
            where order.PublicConsentAtUtc != null && order.ShownOnWebsiteSinceUtc != null && order.Status != OrderStatus.Cancelled
            select new OrderEntryRow(
                entry.Id,
                entry.Position,
                order.Id,
                order.PublicName ?? order.TeamName,
                order.PublicProductLineId,
                order.ShownOnWebsiteSinceUtc,
                entry.UpdatedAtUtc ?? entry.CreatedAtUtc,
                order.UpdatedAtUtc ?? order.CreatedAtUtc))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var orderIds = orderEntries.ConvertAll(entry => entry.OrderId);
        var itemRows = orderIds.Count == 0
            ? []
            : await (
                from item in db.Set<OrderItem>().AsNoTracking()
                where orderIds.Contains(item.OrderId)
                join type in db.ProductTypes.AsNoTracking() on item.ProductTypeId equals type.Id
                select new ItemRow(item.OrderId, type.ProductLineId, item.Quantity))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        var photoRows = orderIds.Count == 0
            ? []
            : await db.Set<OrderImage>()
                .AsNoTracking()
                .Where(image => orderIds.Contains(image.OrderId))
                .OrderBy(image => image.Position)
                .ThenBy(image => image.Slot)
                .Select(image => new PhotoRow(image.OrderId, image.PublicId, image.Width, image.Height))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        var itemsByOrder = itemRows.ToLookup(item => item.OrderId);
        var photosByOrder = photoRows.ToLookup(photo => photo.OrderId);

        List<PublicGalleryRow> rows = [];
        foreach (var entry in orderEntries)
        {
            var filing = itemsByOrder[entry.OrderId].Select(item => new PublicFilingItem(item.ProductLineId, item.Quantity)).ToList();
            var lineId = entry.PublicProductLineId ?? OrderPublicFiling.AutoLine(filing, lineOrder);
            var photos = photosByOrder[entry.OrderId].Select(photo => new PublicGalleryPhotoRow(photo.PublicId, photo.Width, photo.Height)).ToList();
            if (string.IsNullOrWhiteSpace(entry.Team) || lineId is not { } line || !shown.TryGetValue(line, out var shownLine) || photos.Count == 0)
            {
                continue;
            }

            rows.Add(new PublicGalleryRow(
                entry.Id,
                entry.Position,
                GalleryEntryKind.Order,
                entry.Team,
                line,
                shownLine.Key,
                shownLine.ShortName,
                ArtName(shownLine.Art),
                OrderPublicFiling.Pieces(filing),
                null,
                entry.ShownSinceUtc,
                Newest(entry.EntryChangedAtUtc, entry.OrderChangedAtUtc, shownLine.ChangedAtUtc),
                photos));
        }

        var uploads = await db.GalleryEntries
            .AsNoTracking()
            .Where(entry => entry.Kind == GalleryEntryKind.Upload
                && entry.IsShown
                && entry.PublicId != null
                && entry.Width != null
                && entry.Height != null
                && entry.TeamName != null
                && entry.ProductLineId != null)
            .Select(entry => new UploadRow(
                entry.Id,
                entry.Position,
                entry.TeamName!,
                entry.ProductLineId!.Value,
                entry.Pieces,
                entry.Note,
                entry.PublicId!,
                entry.Width!.Value,
                entry.Height!.Value,
                entry.UpdatedAtUtc ?? entry.CreatedAtUtc))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var upload in uploads)
        {
            if (!shown.TryGetValue(upload.LineId, out var shownLine))
            {
                continue;
            }

            rows.Add(new PublicGalleryRow(
                upload.Id,
                upload.Position,
                GalleryEntryKind.Upload,
                upload.Team,
                upload.LineId,
                shownLine.Key,
                shownLine.ShortName,
                ArtName(shownLine.Art),
                upload.Pieces,
                upload.Note,
                null,
                Newest(upload.ChangedAtUtc, shownLine.ChangedAtUtc),
                [new PublicGalleryPhotoRow(upload.PublicId, upload.Width, upload.Height)]));
        }

        var ordered = rows.OrderBy(row => row.Position).ThenBy(row => row.Id).ToList();
        return new PublicGalleryRead(ordered, [.. lines.Where(line => line.IsActive).Select(line => new PublicGalleryLineRow(line.Id, line.Key, line.ShortName))]);
    }

    /// <summary>Names a placeholder drawing the way the JSON does: "LongSleeves" is sent as "longSleeves".</summary>
    /// <param name="art">The drawing.</param>
    /// <returns>The name.</returns>
    internal static string ArtName(PlaceholderArt art)
    {
        var name = art.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }

    private static DateTimeOffset Newest(params DateTimeOffset[] stamps) => stamps.Max();

    private sealed record LineRow(Guid Id, string Key, string ShortName, PlaceholderArt Art, bool IsActive, DateTimeOffset ChangedAtUtc);

    private sealed record OrderEntryRow(
        Guid Id,
        int Position,
        Guid OrderId,
        string? Team,
        Guid? PublicProductLineId,
        DateTimeOffset? ShownSinceUtc,
        DateTimeOffset EntryChangedAtUtc,
        DateTimeOffset OrderChangedAtUtc);

    private sealed record ItemRow(Guid OrderId, Guid? ProductLineId, int Quantity);

    private sealed record PhotoRow(Guid OrderId, string PublicId, int Width, int Height);

    private sealed record UploadRow(Guid Id, int Position, string Team, Guid LineId, int? Pieces, string? Note, string PublicId, int Width, int Height, DateTimeOffset ChangedAtUtc);
}
