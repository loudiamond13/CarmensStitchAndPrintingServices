namespace Csps.Application.QuoteRequests;

/// <summary>The values the New Order form starts with when staff turn a quote request into an order (INQ-06, D-20). Nothing is saved.</summary>
/// <param name="QuoteRequestId">The request, sent back as <c>quoteRequestId</c> when the order is saved.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team; null when none.</param>
/// <param name="ContactNumber">The mobile number in its display form, such as <c>0917 123 4567</c>, which the order number rule accepts.</param>
/// <param name="Email">The email; null when none.</param>
/// <param name="Notes">The visitor's message, for the order notes; null when none.</param>
/// <param name="ReceivedOn">The business day the request arrived.</param>
/// <param name="ProductTypeId">The suggested product type of the first item; null for Custom design, Not sure yet, no choice or a line with no active type.</param>
public sealed record OrderPrefillResponse(
    Guid QuoteRequestId,
    string CustomerName,
    string? TeamName,
    string ContactNumber,
    string? Email,
    string? Notes,
    DateOnly ReceivedOn,
    Guid? ProductTypeId);
