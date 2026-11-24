using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>The error values the quote request use cases return.</summary>
public static class QuoteRequestErrors
{
    /// <summary>The machine code of a quote form that breaks field rules.</summary>
    public const string ValidationCode = QuoteRequestRules.InvalidCode;

    /// <summary>The text above the field errors.</summary>
    public const string ValidationMessage = QuoteRequestRules.InvalidMessage;

    /// <summary>The machine code of an inbox query with a bad status, search or page (INQ-05).</summary>
    public const string ListValidationCode = "quote-requests.list-invalid";

    /// <summary>The text above the field errors of a bad inbox query.</summary>
    public const string ListValidationMessage = "Check the status, search and page settings.";

    /// <summary>The code of a request that does not exist.</summary>
    public const string NotFoundCode = "quote-requests.not-found";

    /// <summary>The plain-English text for a request that does not exist.</summary>
    public const string NotFoundMessage = "This quote request was not found.";

    /// <summary>The code of a status change sent with an out-of-date row version.</summary>
    public const string ConflictCode = "quote-requests.conflict";

    /// <summary>The code of a status change on a request that became an order (D-15).</summary>
    public const string ConvertedLockedCode = QuoteRequestRules.ConvertedLockedCode;

    /// <summary>The field the version error of a delete is listed on.</summary>
    public const string VersionField = "version";

    /// <summary>The plain-English text of a delete refused because the request became an order (D-16).</summary>
    public const string ConvertedDeleteLockedMessage = "A request that became an order can't be deleted.";

    /// <summary>Gets the 400 for a delete of a request that became an order, listed on the status as for a status change.</summary>
    public static Error ConvertedDeleteLocked { get; } = Error.Validation(
        ConvertedLockedCode,
        ConvertedDeleteLockedMessage,
        new Dictionary<string, string[]> { [QuoteRequestRules.StatusField] = [ConvertedDeleteLockedMessage] });

    /// <summary>The code of a second order from a request that already became one (D-23): <c>quote-requests.already-converted</c>.</summary>
    public const string AlreadyConvertedCode = QuoteRequestRules.AlreadyConvertedCode;

    /// <summary>The extra member of that 409 that holds the id of the order the request became.</summary>
    public const string OrderIdKey = "orderId";

    /// <summary>The extra member of that 409 that holds the number of the order the request became.</summary>
    public const string OrderNumberKey = "orderNumber";

    /// <summary>Builds the 409 for an order save from a request that already became an order, naming that order so the page can link to it.</summary>
    /// <param name="orderId">The order the request became; no extra members when null.</param>
    /// <param name="orderNumber">That order's number.</param>
    /// <returns>The error.</returns>
    public static Error AlreadyConverted(Guid? orderId, string? orderNumber) => orderId is { } id && orderNumber is { } number
        ? Error.Conflict(AlreadyConvertedCode, QuoteRequestRules.AlreadyConvertedMessage, new Dictionary<string, object> { [OrderIdKey] = id, [OrderNumberKey] = number })
        : Error.Conflict(AlreadyConvertedCode, QuoteRequestRules.AlreadyConvertedMessage);

    /// <summary>Gets the 409 for a change made from an out-of-date copy of the request.</summary>
    public static Error Conflict { get; } = Error.Conflict(ConflictCode, EditErrors.StaleMessage);

    /// <summary>The code of a photo upload that is not allowed: wrong key, wrong id, expired key, filled or unknown place, or a spam request.</summary>
    public const string PhotoNotFoundCode = "quote-requests.photo-not-found";

    /// <summary>The plain-English text of that 404; it never says which part was wrong (CWE-639, CWE-203).</summary>
    public const string PhotoNotFoundMessage = "This photo could not be added to the request.";

    /// <summary>The code of a send whose form ticket is missing, changed, unreadable or too old (Pitfall 4): the browser gets a new ticket and sends once more.</summary>
    public const string TicketExpiredCode = "quote-requests.ticket-expired";

    /// <summary>The plain-English text of that 400.</summary>
    public const string TicketExpiredMessage = "The form timed out. Please send it again.";

    /// <summary>The field the ticket error is listed on.</summary>
    public const string TicketField = "ticket";

    /// <summary>The extra member of the ticket-expired 400 that holds the ticket to use for the resend (D-38).</summary>
    public const string ReplacementTicketKey = "replacementTicket";

    /// <summary>The extra member of the ticket-expired 400 that holds how long the form waits before the resend (D-41).</summary>
    public const string MinimumSecondsKey = "minimumSeconds";

    /// <summary>Builds the answer for a send with no good form ticket: a 400, never a silent success, so a real lead is not lost.</summary>
    /// <param name="replacementTicket">A new ticket, issued already as old as the minimum time, so the one resend is not treated as too fast.</param>
    /// <param name="minimumSeconds">How long the form waits after it gets the ticket (QuoteRequests:MinimumSeconds).</param>
    /// <returns>The error.</returns>
    public static Error TicketExpired(string replacementTicket, int minimumSeconds) => Error.Validation(
        TicketExpiredCode,
        TicketExpiredMessage,
        new Dictionary<string, string[]> { [TicketField] = [TicketExpiredMessage] },
        new Dictionary<string, object> { [ReplacementTicketKey] = replacementTicket, [MinimumSecondsKey] = minimumSeconds });

    /// <summary>The code of a send over the per-sender daily limit; the same code the per-address rate limit uses (D-37).</summary>
    public const string SenderLimitCode = "rate-limited";

    /// <summary>The plain-English text of that 429; the same words as the per-address rate limit (D-26, D-37).</summary>
    public const string SenderLimitMessage = "Too many attempts from this address. Please wait and try again.";

    /// <summary>Builds the 429 for a mobile number or email that has sent its daily number of requests.</summary>
    /// <param name="retryAfter">How long until the oldest counted request leaves the window; must be positive.</param>
    /// <returns>The error.</returns>
    public static Error SenderLimit(TimeSpan retryAfter) => Error.TooManyRequests(SenderLimitCode, SenderLimitMessage, retryAfter);

    /// <summary>Gets the answer for a request that does not exist: a 404.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the one answer for every photo upload that is not allowed: a 404.</summary>
    public static Error PhotoNotFound { get; } = Error.NotFound(PhotoNotFoundCode, PhotoNotFoundMessage);

    /// <summary>Builds the 422 for a file that is not a photo we can take (wrong type by its first bytes, or metadata that cannot be removed safely).</summary>
    /// <param name="fileName">The name the browser sent; cleaned for the message.</param>
    /// <returns>The error.</returns>
    public static Error PhotoNotAPhoto(string? fileName) => PhotoRefused(QuoteRequestRules.PhotoTypeFormat, fileName);

    /// <summary>Builds the 422 for a photo over the pixel or side limit.</summary>
    /// <param name="fileName">The name the browser sent; cleaned for the message.</param>
    /// <returns>The error.</returns>
    public static Error PhotoTooBig(string? fileName) => PhotoRefused(QuoteRequestRules.PhotoTooBigFormat, fileName);

    /// <summary>Gets the plain-English text of the 413 for a file over 10 MB.</summary>
    /// <param name="fileName">The name the browser sent; cleaned for the message.</param>
    /// <returns>The message.</returns>
    public static string PhotoTooLargeMessage(string? fileName) =>
        Fill(QuoteRequestRules.PhotoTooLargeFormat, fileName);

    private static Error PhotoRefused(string format, string? fileName) =>
        Error.BusinessRule(QuoteRequestRules.PhotoRefusedCode, Fill(format, fileName));

    private static string Fill(string format, string? fileName) => format.Replace("{0}", ImageErrors.CleanName(fileName), StringComparison.Ordinal);
}
