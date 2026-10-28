namespace Csps.Application.OrderLists;

/// <summary>One entry in an order list that pickers and filters read (D-16, D-17, D-18, D-19).</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Status"><c>active</c>, or <c>retired</c> so a picker can hide it while a filter keeps it.</param>
/// <param name="IsOthers">True only for the protected Others entry of the order expense categories.</param>
public sealed record OrderListItem(Guid Id, string Name, string Tone, string Status, bool IsOthers)
{
    /// <summary>The status of an entry that can be picked.</summary>
    public const string ActiveStatus = "active";

    /// <summary>The status of a retired entry.</summary>
    public const string RetiredStatus = "retired";
}
