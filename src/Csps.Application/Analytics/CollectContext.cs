namespace Csps.Application.Analytics;

/// <summary>
/// What the server knows about a page view call beyond its body, read by the controller from the headers and cookies. Neither value is stored
/// or logged by the anonymous count (ANL-06).
/// </summary>
/// <param name="UserAgent">The <c>User-Agent</c> header, or null when it is missing.</param>
/// <param name="IsStaff">True when the call carries the staff marker cookie or an <c>Authorization</c> header (D-21).</param>
public sealed record CollectContext(string? UserAgent, bool IsStaff);
