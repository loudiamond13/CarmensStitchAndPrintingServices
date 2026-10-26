using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;

namespace Csps.Application.ExpenseCategories;

/// <summary>One category with its usage count, who recorded and last changed it, and the version a save must send back (CEXP-02, SEC-07, D-10).</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Status"><c>active</c> or <c>retired</c>.</param>
/// <param name="IsOthers">True only for the catch-all Others category.</param>
/// <param name="ExpenseCount">How many expenses use the category, soft-deleted ones included; a category with none can be deleted (D-10, D-30).</param>
/// <param name="RecordedBy">Who added it; null reads as System (the seeded categories).</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until a change.</param>
/// <param name="LastChangedAt">When it was last changed; null until a change.</param>
/// <param name="Version">The base64 of the eight-byte row version a save must send back.</param>
public sealed record ExpenseCategoryDetailResponse(
    Guid Id,
    string Name,
    string Tone,
    string Status,
    bool IsOthers,
    int ExpenseCount,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt,
    string Version)
{
    /// <summary>Builds the response from the read model.</summary>
    /// <param name="view">The category as read.</param>
    /// <returns>The response.</returns>
    public static ExpenseCategoryDetailResponse From(ExpenseCategoryDetailView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new ExpenseCategoryDetailResponse(
            view.Id,
            view.Name,
            view.Tone,
            view.Retired ? ExpenseCategoryListItem.RetiredStatus : ExpenseCategoryListItem.ActiveStatus,
            view.IsOthers,
            view.ExpenseCount,
            view.RecordedBy,
            view.CreatedAtUtc,
            view.LastChangedBy,
            view.UpdatedAtUtc,
            RowVersions.ToText(view.RowVersion));
    }
}
