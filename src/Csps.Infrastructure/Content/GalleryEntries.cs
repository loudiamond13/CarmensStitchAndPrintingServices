using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// <see cref="IGalleryEntries"/> over EF: the rows a handler changes are loaded as tracked rows and saved by the unit of work, so the
/// stamp, audit and cache-clearing interceptors all run. The Manager's list is read without tracking from the same tables the public
/// projection reads, with the same rule for an order's line, so the two never disagree about where an item is filed.
/// </summary>
internal sealed class GalleryEntries(CspsDbContext context) : IGalleryEntries
{
    public Task<GalleryEntry?> FindForOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        context.GalleryEntries.SingleOrDefaultAsync(entry => entry.OrderId == orderId, cancellationToken);

    public Task<GalleryEntry?> FindUploadAsync(Guid id, CancellationToken cancellationToken) =>
        context.GalleryEntries.SingleOrDefaultAsync(entry => entry.Id == id && entry.Kind == GalleryEntryKind.Upload, cancellationToken);

    // Positions are given out under the site-content lock, so two writers never take the same top place.
    public async Task<int> GetTopPositionAsync(CancellationToken cancellationToken) =>
        (await context.GalleryEntries.MinAsync(entry => (int?)entry.Position, cancellationToken).ConfigureAwait(false) ?? 1) - 1;

    public async Task<GalleryItemPage> ListAsync(Guid? lineId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var all = await LoadAsync(cancellationToken).ConfigureAwait(false);
        var matching = lineId is null ? all : all.Where(row => row.LineId == lineId).ToList();
        var slice = matching.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return new GalleryItemPage(await WithCoversAsync(slice, cancellationToken).ConfigureAwait(false), matching.Count);
    }

    public async Task<GalleryItemRow?> GetItemAsync(Guid id, CancellationToken cancellationToken)
    {
        var all = await LoadAsync(cancellationToken).ConfigureAwait(false);
        var row = all.Find(item => item.Id == id);
        return row is null ? null : (await WithCoversAsync([row], cancellationToken).ConfigureAwait(false))[0];
    }

    public void Add(GalleryEntry entry) => context.GalleryEntries.Add(entry);

    public void Remove(GalleryEntry entry) => context.GalleryEntries.Remove(entry);

    // Every item a Manager sees, in gallery order (position, then id). An order is listed while its shown date is set; its entry is
    // joined to the order through the soft-delete filter, so a deleted order is not listed. An order's cover is read later, for the
    // page only.
    private async Task<List<GalleryItemRow>> LoadAsync(CancellationToken cancellationToken)
    {
        var lines = await context.ProductLines
            .AsNoTracking()
            .OrderBy(line => line.Position)
            .ThenBy(line => line.Id)
            .Select(line => new LineRow(line.Id, line.ShortName, line.IsActive))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var lineOrder = lines.ConvertAll(line => line.Id);
        var lineById = lines.ToDictionary(line => line.Id);

        var orderEntries = await (
            from entry in context.GalleryEntries.AsNoTracking()
            where entry.Kind == GalleryEntryKind.Order
            join order in context.Orders.AsNoTracking() on entry.OrderId equals (Guid?)order.Id
            where order.ShownOnWebsiteSinceUtc != null
            select new OrderEntryRow(entry.Id, entry.Position, order.Id, order.Number, order.PublicName ?? order.TeamName, order.PublicProductLineId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var orderIds = orderEntries.ConvertAll(entry => entry.OrderId);
        var itemRows = orderIds.Count == 0
            ? []
            : await (
                from item in context.Set<OrderItem>().AsNoTracking()
                where orderIds.Contains(item.OrderId)
                join type in context.ProductTypes.AsNoTracking() on item.ProductTypeId equals type.Id
                select new ItemRow(item.OrderId, type.ProductLineId, item.Quantity))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        var itemsByOrder = itemRows.ToLookup(item => item.OrderId);

        List<GalleryItemRow> rows = [];
        foreach (var entry in orderEntries)
        {
            var filing = itemsByOrder[entry.OrderId].Select(item => new PublicFilingItem(item.ProductLineId, item.Quantity)).ToList();
            var lineId = entry.PublicProductLineId ?? OrderPublicFiling.AutoLine(filing, lineOrder);
            var line = lineId is { } id && lineById.TryGetValue(id, out var found) ? found : null;
            rows.Add(new GalleryItemRow(
                entry.Id,
                GalleryEntryKind.Order,
                entry.Position,
                entry.Team ?? string.Empty,
                line?.Id,
                line?.ShortName,
                line is { IsActive: false },
                OrderPublicFiling.Pieces(filing),
                true,
                entry.OrderId,
                entry.Number,
                null,
                null,
                null,
                null,
                []));
        }

        var uploads = await context.GalleryEntries
            .AsNoTracking()
            .Where(entry => entry.Kind == GalleryEntryKind.Upload)
            .Select(entry => new UploadRow(entry.Id, entry.Position, entry.TeamName, entry.ProductLineId, entry.Pieces, entry.Note, entry.IsShown, entry.PublicId, entry.Width, entry.Height, entry.RowVersion))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var upload in uploads)
        {
            var line = upload.LineId is { } id && lineById.TryGetValue(id, out var found) ? found : null;
            rows.Add(new GalleryItemRow(
                upload.Id,
                GalleryEntryKind.Upload,
                upload.Position,
                upload.Team ?? string.Empty,
                line?.Id,
                line?.ShortName,
                line is { IsActive: false },
                upload.Pieces,
                upload.IsShown,
                null,
                null,
                upload.Note,
                upload.PublicId,
                upload.Width,
                upload.Height,
                upload.RowVersion));
        }

        return [.. rows.OrderBy(row => row.Position).ThenBy(row => row.Id)];
    }

    // Gives each order row on the page its first photo, the cover.
    private async Task<IReadOnlyList<GalleryItemRow>> WithCoversAsync(List<GalleryItemRow> rows, CancellationToken cancellationToken)
    {
        var orderIds = rows.Where(row => row.OrderId is not null).Select(row => row.OrderId!.Value).ToList();
        if (orderIds.Count == 0)
        {
            return rows;
        }

        var photos = await context.Set<OrderImage>()
            .AsNoTracking()
            .Where(image => orderIds.Contains(image.OrderId))
            .OrderBy(image => image.Position)
            .ThenBy(image => image.Slot)
            .Select(image => new CoverRow(image.OrderId, image.PublicId, image.Width, image.Height))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var cover = photos.GroupBy(photo => photo.OrderId).ToDictionary(group => group.Key, group => group.First());
        return [.. rows.Select(row => row.OrderId is { } id && cover.TryGetValue(id, out var photo)
            ? row with { PhotoPublicId = photo.PublicId, PhotoWidth = photo.Width, PhotoHeight = photo.Height }
            : row)];
    }

    private sealed record LineRow(Guid Id, string ShortName, bool IsActive);

    private sealed record OrderEntryRow(Guid Id, int Position, Guid OrderId, string Number, string? Team, Guid? PublicProductLineId);

    private sealed record ItemRow(Guid OrderId, Guid? ProductLineId, int Quantity);

    private sealed record CoverRow(Guid OrderId, string PublicId, int Width, int Height);

    private sealed record UploadRow(Guid Id, int Position, string? Team, Guid? LineId, int? Pieces, string? Note, bool IsShown, string? PublicId, int? Width, int? Height, byte[] RowVersion);
}
