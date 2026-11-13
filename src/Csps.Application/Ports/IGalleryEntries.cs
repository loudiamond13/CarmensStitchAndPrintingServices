using Csps.Domain.Content;

namespace Csps.Application.Ports;

/// <summary>
/// Access to the places in the public gallery (D-10, GAL-03). Application never sees EF: writes go through tracked rows that the unit of
/// work saves with their versions checked.
/// </summary>
public interface IGalleryEntries
{
    /// <summary>Loads the entry of a shown order as a tracked row, so a removal is saved by the unit of work.</summary>
    /// <param name="orderId">The order.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The entry, or null when the order has none.</returns>
    Task<GalleryEntry?> FindForOrderAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>Loads a direct upload as a tracked row. An order entry is not found here: it is managed from its order (D-27).</summary>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The entry, or null when it does not exist or is an order entry.</returns>
    Task<GalleryEntry?> FindUploadAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gives the place that puts a new entry above every other one.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One below the lowest position, or 0 when there are no entries.</returns>
    Task<int> GetTopPositionAsync(CancellationToken cancellationToken);

    /// <summary>Lists one page of the gallery items a Manager sees, in gallery order: every upload and every order that is shown.</summary>
    /// <param name="lineId">Only the items filed under this line; null for every line.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Rows per page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page and the total over every page.</returns>
    Task<GalleryItemPage> ListAsync(Guid? lineId, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>Reads one item as the Manager's list shows it.</summary>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The row, or null when the entry does not exist or is not listed.</returns>
    Task<GalleryItemRow?> GetItemAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Marks a new entry for insert. The next save writes it.</summary>
    /// <param name="entry">The new entry.</param>
    void Add(GalleryEntry entry);

    /// <summary>Marks a tracked entry for removal. The next save deletes it.</summary>
    /// <param name="entry">The tracked entry.</param>
    void Remove(GalleryEntry entry);
}
