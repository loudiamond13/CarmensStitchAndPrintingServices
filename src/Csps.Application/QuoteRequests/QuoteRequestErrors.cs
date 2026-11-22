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

    /// <summary>Gets the answer for a request that does not exist: a 404.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);
}
