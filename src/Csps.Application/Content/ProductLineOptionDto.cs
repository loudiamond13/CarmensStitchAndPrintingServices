namespace Csps.Application.Content;

/// <summary>One product line the order window offers (D-09, D-16).</summary>
/// <param name="Id">The line id.</param>
/// <param name="Title">The title.</param>
/// <param name="ShortName">The short name.</param>
public sealed record ProductLineOptionDto(Guid Id, string Title, string ShortName);
