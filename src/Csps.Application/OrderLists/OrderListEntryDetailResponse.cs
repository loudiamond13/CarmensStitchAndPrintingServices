using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;

namespace Csps.Application.OrderLists;

/// <summary>One order list entry with its usage count, who recorded and last changed it, and the version a save must send back (D-19, SEC-07).</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Status"><c>active</c> or <c>retired</c>.</param>
/// <param name="IsOthers">True only for the protected order expense Others.</param>
/// <param name="UseCount">How many rows use the entry, soft-deleted orders included; an entry with none can be deleted.</param>
/// <param name="RecordedBy">Who added it; null reads as System (the seeded entries).</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until a change.</param>
/// <param name="LastChangedAt">When it was last changed; null until a change.</param>
/// <param name="Version">The base64 of the eight-byte row version a save must send back.</param>
public sealed record OrderListEntryDetailResponse(
    Guid Id,
    string Name,
    string Tone,
    string Status,
    bool IsOthers,
    int UseCount,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt,
    string Version)
{
    /// <summary>Builds the response from the read model.</summary>
    /// <param name="view">The entry as read.</param>
    /// <returns>The response.</returns>
    public static OrderListEntryDetailResponse From(OrderListEntryDetailView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new OrderListEntryDetailResponse(
            view.Id,
            view.Name,
            view.Tone,
            view.Retired ? OrderListItem.RetiredStatus : OrderListItem.ActiveStatus,
            view.IsOthers,
            view.UseCount,
            view.RecordedBy,
            view.CreatedAtUtc,
            view.LastChangedBy,
            view.UpdatedAtUtc,
            RowVersions.ToText(view.RowVersion));
    }
}
