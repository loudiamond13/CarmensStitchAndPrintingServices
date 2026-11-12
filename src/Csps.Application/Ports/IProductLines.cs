using Csps.Domain.Content;
using Csps.Domain.OrderLists;

namespace Csps.Application.Ports;

/// <summary>
/// Access to the product lines a Manager edits (CONT-02). Application never sees EF: reads map to these records, and writes go through
/// tracked rows that the unit of work saves with their versions checked.
/// </summary>
public interface IProductLines
{
    /// <summary>Reads every line, shown and hidden, in display order (position, then id), with what files under it.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The lines.</returns>
    Task<IReadOnlyList<ProductLineListRow>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Reads one line with the product types filed under it and who last changed it, straight from the database.</summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The line, or null when there is none.</returns>
    Task<ProductLineDetailRow?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads one line as a tracked row, so a change to it is saved by the unit of work.</summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The line, or null when there is none.</returns>
    Task<ProductLine?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads the line next to a line in the display order as a tracked row.</summary>
    /// <param name="line">The line that moves.</param>
    /// <param name="up">True for the one before it, false for the one after it.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The neighbour, or null when the line is already at that end.</returns>
    Task<ProductLine?> FindNeighbourAsync(ProductLine line, bool up, CancellationToken cancellationToken);

    /// <summary>Reads the keys of every line, so a new key can be made unique.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The keys, compared without regard to letter case.</returns>
    Task<IReadOnlySet<string>> GetKeysAsync(CancellationToken cancellationToken);

    /// <summary>Tells whether another line already uses a short name, comparing without regard to letter case and trailing spaces, the same way the unique index does.</summary>
    /// <param name="shortName">The trimmed short name.</param>
    /// <param name="excluding">A line to leave out, so an edit can keep its own short name; none when null.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>True when another line uses the short name.</returns>
    Task<bool> ShortNameTakenAsync(string shortName, Guid? excluding, CancellationToken cancellationToken);

    /// <summary>Loads the order product types filed under a line as tracked rows.</summary>
    /// <param name="lineId">The line id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The product types.</returns>
    Task<IReadOnlyList<ProductType>> GetLinkedTypesAsync(Guid lineId, CancellationToken cancellationToken);

    /// <summary>Loads the order product types with the given ids as tracked rows.</summary>
    /// <param name="ids">The ids.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The product types that exist; an unknown id has none.</returns>
    Task<IReadOnlyList<ProductType>> FindTypesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);

    /// <summary>Reads the titles of the lines with the given ids.</summary>
    /// <param name="ids">The ids.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The title of each line that exists, by id.</returns>
    Task<IReadOnlyDictionary<Guid, string>> GetTitlesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);

    /// <summary>Gives the place at the end of the display order.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One more than the highest position, or 1 when there are no lines.</returns>
    Task<int> GetNextPositionAsync(CancellationToken cancellationToken);

    /// <summary>Marks a new line for insert. The next save writes it.</summary>
    /// <param name="line">The new line.</param>
    void Add(ProductLine line);

    /// <summary>Marks a tracked line for removal. The next save deletes it.</summary>
    /// <param name="line">The tracked line.</param>
    void Remove(ProductLine line);
}

/// <summary>One line of the list as the read port returns it.</summary>
/// <param name="Line">The line.</param>
/// <param name="ProductTypeIds">The order product types filed under it, A to Z.</param>
/// <param name="PhotoCount">How many photos it has.</param>
/// <param name="GalleryItemCount">How many gallery items are filed under it.</param>
public sealed record ProductLineListRow(ProductLine Line, IReadOnlyList<Guid> ProductTypeIds, int PhotoCount, int GalleryItemCount);

/// <summary>One line with who last changed it, as the detail read returns it.</summary>
/// <param name="Line">The line.</param>
/// <param name="ProductTypeIds">The order product types filed under it, A to Z.</param>
/// <param name="UpdatedByName">The name of the person who last changed it; null when no person did.</param>
public sealed record ProductLineDetailRow(ProductLine Line, IReadOnlyList<Guid> ProductTypeIds, string? UpdatedByName);
