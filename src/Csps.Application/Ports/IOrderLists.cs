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
}

/// <summary>One list entry as the read port returns it.</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the entry is retired.</param>
/// <param name="IsOthers">True for the protected Others entry.</param>
public sealed record OrderListEntryView(Guid Id, string Name, string Tone, bool Retired, bool IsOthers);
