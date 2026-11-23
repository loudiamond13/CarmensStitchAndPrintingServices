using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>Checks the staff inbox query (SEC-03, WEB-10). Compile-only stub: the rules come next.</summary>
public sealed class ListQuoteRequestsRequestValidator : AbstractValidator<ListQuoteRequestsRequest>
{
    /// <summary>The message for a status that is not one of the five.</summary>
    public const string StatusInvalid = "Choose a status.";

    /// <summary>The message for a page size that is not 10, 20, 50 or 100.</summary>
    public const string SizeInvalid = "Use a page size of 10, 20, 50 or 100.";
}
