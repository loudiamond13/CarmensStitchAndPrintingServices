namespace Csps.Application.QuoteRequests;

/// <summary>The answer to a saved quote request. It names the request so the next steps (photos) can refer to it, and nothing more.</summary>
/// <param name="Id">The id of the new request.</param>
public sealed record CreateQuoteRequestResponse(Guid Id);
