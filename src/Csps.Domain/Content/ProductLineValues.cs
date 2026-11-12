namespace Csps.Domain.Content;

/// <summary>
/// What a Manager typed for a product line, as typed (CONT-02, D-01, D-07, D-34). <see cref="ProductLine.Check"/> judges it and the
/// line trims the texts it keeps. The minimum is a number so that a fraction such as 1.5 is refused with the same message as 0.
/// </summary>
/// <param name="Title">The title.</param>
/// <param name="ShortName">The short name.</param>
/// <param name="Number">The number on the drawing; empty for none.</param>
/// <param name="CardText">The Home card text.</param>
/// <param name="Description">The Products page description.</param>
/// <param name="FabricText">What the Fabric card says.</param>
/// <param name="CollarText">What the Collar style card says.</param>
/// <param name="CutText">What the Cut and fit card says.</param>
/// <param name="NamesText">What the Names and numbers card says.</param>
/// <param name="LogosText">What the Logos and sponsors card says.</param>
/// <param name="StartsAtPrice">The starting price per piece; null for none.</param>
/// <param name="MinimumQuantity">The minimum order in pieces; null for none.</param>
/// <param name="IsActive">True to show the line on the website; null keeps the line as it is (a new line then starts hidden).</param>
public sealed record ProductLineValues(
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
    bool? IsActive);

/// <summary>What an edit changed in a product line (AUDIT-01).</summary>
/// <param name="Fields">The API names of the changed fields in form order, such as <c>title</c> or <c>cardText</c>; the shown flag is not one of them.</param>
/// <param name="OldTitle">The title before.</param>
/// <param name="NewTitle">The title after.</param>
/// <param name="OldShortName">The short name before.</param>
/// <param name="NewShortName">The short name after.</param>
/// <param name="OldPrice">The starting price before.</param>
/// <param name="NewPrice">The starting price after.</param>
/// <param name="OldMinimum">The minimum order before.</param>
/// <param name="NewMinimum">The minimum order after.</param>
/// <param name="NowShown">True when the line was hidden and is now shown, false for the other way round, null when the flag did not change.</param>
public sealed record ProductLineChanges(
    IReadOnlyList<string> Fields,
    string OldTitle,
    string NewTitle,
    string OldShortName,
    string NewShortName,
    decimal? OldPrice,
    decimal? NewPrice,
    int? OldMinimum,
    int? NewMinimum,
    bool? NowShown)
{
    /// <summary>Gets a value indicating whether anything changed.</summary>
    public bool HasChange => Fields.Count > 0 || NowShown is not null;
}
