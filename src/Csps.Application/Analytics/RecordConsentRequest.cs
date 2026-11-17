namespace Csps.Application.Analytics;

/// <summary>
/// One cookie decision as the browser sends it (ANL-07). Stats is null for a map-only save (D-18). The browser never sends the GPC signal
/// in the body: the server reads the <c>Sec-GPC</c> header (D-20).
/// </summary>
/// <param name="ConsentId">The consent chain id from the saved cookie, or null on a first decision.</param>
/// <param name="PolicyVersion">The cookie policy version the visitor saw, like <c>1.0</c>.</param>
/// <param name="Stats">True or false when the visitor chose, null when not chosen.</param>
/// <param name="Map">True when the visitor allowed the Google map.</param>
/// <param name="Source">Where the choice was made: <c>bar</c>, <c>settings</c> or <c>map-link</c>.</param>
public sealed record RecordConsentRequest(string? ConsentId = null, string? PolicyVersion = null, bool? Stats = null, bool Map = false, string? Source = null)
{
    /// <summary>Gets the request used when no body arrives, so the field errors name every missing field.</summary>
    public static RecordConsentRequest Empty { get; } = new();
}
