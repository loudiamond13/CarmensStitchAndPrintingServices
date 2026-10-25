namespace Csps.Application.ExpenseCategories;

/// <summary>One category in the list the Add picker and the list filter read (D-11, D-15).</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Status"><c>active</c>, or <c>retired</c> so the Add picker can hide it while the list filter keeps it.</param>
/// <param name="IsOthers">True only for the catch-all Others category.</param>
public sealed record ExpenseCategoryListItem(Guid Id, string Name, string Tone, string Status, bool IsOthers)
{
    /// <summary>The status of a category that can be picked.</summary>
    public const string ActiveStatus = "active";

    /// <summary>The status of a retired category.</summary>
    public const string RetiredStatus = "retired";
}
