namespace Csps.Application.ExpenseCategories;

/// <summary>
/// The Add Category form (D-08, D-13). Any other member in the body is ignored: who added the category and when come from the
/// token and the clock (SEC-08).
/// </summary>
/// <param name="Name">The name; required after trimming, at most 40 characters, unique among all categories.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
public sealed record CreateExpenseCategoryRequest(string? Name, string? Tone) : IExpenseCategoryFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateExpenseCategoryRequest Empty { get; } = new(null, null);
}
