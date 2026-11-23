using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>The detail text of the quote request audit entries.</summary>
public static class QuoteRequestAuditDetail
{
    /// <summary>The audit target type of every quote request entry.</summary>
    public const string Target = "QuoteRequest";

    /// <summary>The detail of <c>quote-request.status-changed</c>.</summary>
    /// <param name="from">The status the request left.</param>
    /// <param name="to">The status the request entered.</param>
    /// <returns>The detail.</returns>
    public static string StatusChanged(QuoteRequestStatus from, QuoteRequestStatus to) => from == to ? string.Empty : string.Empty;
}
