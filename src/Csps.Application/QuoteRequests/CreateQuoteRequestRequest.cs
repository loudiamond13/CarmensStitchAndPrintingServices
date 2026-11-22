namespace Csps.Application.QuoteRequests;

/// <summary>
/// The "Get a Quote" form a visitor sends (INQ-01). Any other member in the body, such as a forged <c>createdById</c>,
/// <c>createdAtUtc</c>, <c>status</c> or <c>orderId</c>, is ignored: who made the request, when, its status and its order link come
/// from the server, never from the visitor (SEC-08, CWE-915).
/// </summary>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team or organization.</param>
/// <param name="ContactNumber">A Philippine mobile number.</param>
/// <param name="Email">The email address.</param>
/// <param name="ProductChoice"><c>line</c>, <c>custom</c> or <c>not-sure</c>; empty when nothing was chosen.</param>
/// <param name="ProductLineKey">The key of the chosen product line, when the choice is <c>line</c>.</param>
/// <param name="Quantity">The estimated quantity: <c>1-9</c>, <c>10-20</c>, <c>21-50</c>, <c>51-100</c> or <c>100+</c>.</param>
/// <param name="Message">What the visitor wants made.</param>
/// <param name="Photos">The file names of up to 5 photos the visitor will send next, one call each; none when null or empty.</param>
/// <param name="UploadKey">A key the browser made (32 random bytes as base64url). The server keeps only its SHA-256, and each photo call must send the same key. Required with photos.</param>
public sealed record CreateQuoteRequestRequest(
    string? CustomerName,
    string? TeamName,
    string? ContactNumber,
    string? Email,
    string? ProductChoice,
    string? ProductLineKey,
    string? Quantity,
    string? Message,
    IReadOnlyList<string>? Photos = null,
    string? UploadKey = null)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateQuoteRequestRequest Empty { get; } = new(null, null, null, null, null, null, null, null);
}
