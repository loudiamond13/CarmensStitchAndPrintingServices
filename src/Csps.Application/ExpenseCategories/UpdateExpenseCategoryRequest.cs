namespace Csps.Application.ExpenseCategories;

/// <summary>
/// The Edit Category form (D-12, D-13, SEC-07). It carries the version the form was opened with. Any other member in the body, such as
/// a forged <c>createdById</c> or <c>updatedAt</c>, is ignored: who changed the category and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Name">The name; required after trimming, at most 40 characters, unique among all categories. Others keeps its name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Version">The base64 of the eight-byte row version the form was opened with.</param>
public sealed record UpdateExpenseCategoryRequest(string? Name, string? Tone, string? Version) : IExpenseCategoryFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateExpenseCategoryRequest Empty { get; } = new(null, null, null);
}
