namespace Csps.Application.Expenses;

/// <summary>The category an expense shows: its name and badge tone, and whether it is retired (D-11).</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the category is retired.</param>
public sealed record ExpenseCategoryRef(Guid Id, string Name, string Tone, bool Retired);
