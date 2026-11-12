using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The product line form (CONT-02, SEC-07), for adding and for editing. Any other member in the body is ignored: the key, the order, the
/// drawing, who changed the line and when come from the server (SEC-08).
/// </summary>
/// <param name="Title">The title, required, at most 60 characters.</param>
/// <param name="ShortName">The short name, required, at most 20 characters, and not used by another line.</param>
/// <param name="Number">The number on the drawing, up to 2 letters or digits; empty for none.</param>
/// <param name="CardText">The Home card text, required, at most 140 characters.</param>
/// <param name="Description">The Products page description, required, at most 300 characters.</param>
/// <param name="FabricText">What the Fabric card says, required, at most 120 characters.</param>
/// <param name="CollarText">What the Collar style card says, required, at most 120 characters.</param>
/// <param name="CutText">What the Cut and fit card says, required, at most 120 characters.</param>
/// <param name="NamesText">What the Names and numbers card says, required, at most 120 characters.</param>
/// <param name="LogosText">What the Logos and sponsors card says, required, at most 120 characters.</param>
/// <param name="StartsAtPrice">The starting price per piece, 0.01 to 999,999.99 with at most two decimals; null for none.</param>
/// <param name="MinimumQuantity">The minimum order, a whole number from 1 to 9,999; null for none.</param>
/// <param name="IsActive">True to show the line on the website. A new line is hidden when this is missing; an edit keeps the line as it is when this is missing.</param>
/// <param name="ProductTypeIds">The order product types filed under this line. Missing on an edit keeps the links as they are; a list sets them exactly.</param>
/// <param name="Version">The version the form was opened with; required when editing, ignored when adding.</param>
public sealed record ProductLineRequest(
    string? Title,
    string? ShortName,
    string? Number,
    string? CardText,
    string? Description,
    string? FabricText,
    string? CollarText,
    string? CutText,
    string? NamesText,
    string? LogosText,
    decimal? StartsAtPrice,
    decimal? MinimumQuantity,
    bool? IsActive,
    IReadOnlyList<Guid>? ProductTypeIds,
    string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing part.</summary>
    public static ProductLineRequest Empty { get; } = new(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

    /// <summary>Gets what the form holds, for the domain.</summary>
    /// <returns>The values.</returns>
    public ProductLineValues ToValues() =>
        new(Title, ShortName, Number, CardText, Description, FabricText, CollarText, CutText, NamesText, LogosText, StartsAtPrice, MinimumQuantity, IsActive);
}

/// <summary>The move form: which way a line goes in the order.</summary>
/// <param name="Direction">"up" or "down".</param>
public sealed record MoveProductLineRequest(string? Direction)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static MoveProductLineRequest Empty { get; } = new((string?)null);
}
