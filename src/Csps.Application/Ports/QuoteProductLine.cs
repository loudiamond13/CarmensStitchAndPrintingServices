namespace Csps.Application.Ports;

/// <summary>A shown product line a visitor may choose on the quote form (D-24).</summary>
/// <param name="Id">The line id.</param>
/// <param name="Title">The line title, kept on the request as a snapshot.</param>
public sealed record QuoteProductLine(Guid Id, string Title);
