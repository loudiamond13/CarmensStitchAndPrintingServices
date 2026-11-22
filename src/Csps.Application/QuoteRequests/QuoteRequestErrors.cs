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

    /// <summary>The code of a request that does not exist.</summary>
    public const string NotFoundCode = "quote-requests.not-found";

    /// <summary>The plain-English text for a request that does not exist.</summary>
    public const string NotFoundMessage = "This quote request was not found.";

    /// <summary>The code of a photo upload that is not allowed: wrong key, wrong id, expired key, filled or unknown place, or a spam request.</summary>
    public const string PhotoNotFoundCode = "quote-requests.photo-not-found";

    /// <summary>The plain-English text of that 404; it never says which part was wrong (CWE-639, CWE-203).</summary>
    public const string PhotoNotFoundMessage = "This photo could not be added to the request.";

    /// <summary>Gets the answer for a request that does not exist: a 404.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the one answer for every photo upload that is not allowed: a 404.</summary>
    public static Error PhotoNotFound { get; } = Error.NotFound(PhotoNotFoundCode, PhotoNotFoundMessage);
}
