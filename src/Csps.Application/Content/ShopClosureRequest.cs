namespace Csps.Application.Content;

/// <summary>
/// The closure form (CONT-04, SEC-07), for adding and for editing. Any other member in the body is ignored: who changed the closure
/// and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="FirstDay">The first closed day as "yyyy-MM-dd"; required.</param>
/// <param name="LastDay">The last closed day as "yyyy-MM-dd"; empty or missing means one day.</param>
/// <param name="Note">A short reason shown to visitors, at most 80 characters; empty or missing means none.</param>
/// <param name="Version">The version the form was opened with; required when editing, ignored when adding.</param>
public sealed record ShopClosureRequest(string? FirstDay, string? LastDay, string? Note, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing part.</summary>
    public static ShopClosureRequest Empty { get; } = new(null, null, null, null);
}
