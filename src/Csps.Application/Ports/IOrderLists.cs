using Csps.Application.Users;
using Csps.Domain.OrderLists;

namespace Csps.Application.Ports;

/// <summary>Access to the Manager-editable order lists (D-16, D-17, D-18, D-19). Application never sees EF: reads map to these records.</summary>
public interface IOrderLists
{
    /// <summary>Lists every entry of one list, retired ones included, in no promised order.</summary>
    /// <param name="kind">Which list to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The entries.</returns>
    Task<IReadOnlyList<OrderListEntryView>> ListAsync(OrderListKind kind, CancellationToken cancellationToken);

    /// <summary>Reads the state of the entries with the given ids in one query, for the checks that an order points at an entry that exists and is not retired.</summary>
    /// <param name="kind">Which list to read.</param>
    /// <param name="ids">The entry ids to look up.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One state for each id that exists; an unknown id has no state.</returns>
    Task<IReadOnlyList<OrderListEntryState>> GetStatesAsync(OrderListKind kind, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);

    /// <summary>Loads one entry as a tracked row, so a change to it is saved by the unit of work with its row version checked.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The entry, or null when no such entry exists in the list.</returns>
    Task<OrderListEntry?> FindAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken);

    /// <summary>Reads one entry with how many rows use it and who recorded and last changed it. A deleted person keeps their name.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The detail, or null when no such entry exists in the list.</returns>
    Task<OrderListEntryDetailView?> GetDetailAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken);

    /// <summary>Counts the rows that use an entry: order items, payments or order expenses by list, soft-deleted orders included (D-19, 06 D-30).</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>How many rows point at the entry.</returns>
    Task<int> CountUsesAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken);

    /// <summary>Tells whether an entry of the list already holds a name, retired ones included.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="normalizedName">The name as <see cref="OrderListEntry.Normalize"/> makes it.</param>
    /// <param name="excluding">An entry to leave out, so a rename can keep its own name; none when null.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>True when another entry holds the name.</returns>
    Task<bool> NameTakenAsync(OrderListKind kind, string normalizedName, Guid? excluding, CancellationToken cancellationToken);

    /// <summary>
    /// Starts tracking a new entry. The save that follows throws <see cref="OrderListNameTakenException"/> when another entry took
    /// the name first.
    /// </summary>
    /// <param name="entry">The new entry.</param>
    void Add(OrderListEntry entry);

    /// <summary>
    /// Marks a tracked entry for removal. The save that follows throws <see cref="OrderListEntryInUseException"/> when a row started
    /// using the entry after the caller counted (the foreign key is the backstop).
    /// </summary>
    /// <param name="entry">The entry to remove.</param>
    void Remove(OrderListEntry entry);
}

/// <summary>One list entry as the read port returns it.</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the entry is retired.</param>
/// <param name="IsOthers">True for the protected Others entry.</param>
/// <param name="UseCount">How many rows use the entry, soft-deleted orders included.</param>
public sealed record OrderListEntryView(Guid Id, string Name, string Tone, bool Retired, bool IsOthers, int UseCount);

/// <summary>Whether an entry exists and may still be chosen on a new item.</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Retired">True once the entry is retired.</param>
public sealed record OrderListEntryState(Guid Id, string Name, bool Retired);

/// <summary>One list entry as the detail read returns it, with its row version.</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the entry is retired.</param>
/// <param name="IsOthers">True for the protected Others entry.</param>
/// <param name="UseCount">How many rows use the entry, soft-deleted orders included.</param>
/// <param name="RecordedBy">Who added it; null reads as System (the seeded entries).</param>
/// <param name="CreatedAtUtc">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until a change.</param>
/// <param name="UpdatedAtUtc">When it was last changed; null until a change.</param>
/// <param name="RowVersion">The eight-byte row version a save must send back.</param>
public sealed record OrderListEntryDetailView(
    Guid Id,
    string Name,
    string Tone,
    bool Retired,
    bool IsOthers,
    int UseCount,
    ActorRef? RecordedBy,
    DateTimeOffset CreatedAtUtc,
    ActorRef? LastChangedBy,
    DateTimeOffset? UpdatedAtUtc,
    byte[] RowVersion);
