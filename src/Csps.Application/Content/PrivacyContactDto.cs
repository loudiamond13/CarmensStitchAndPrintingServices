namespace Csps.Application.Content;

/// <summary>
/// The contact email the three legal pages show so a visitor can write about their data (D-13, D-29). It is kept out of the site facts
/// that every page embeds.
/// </summary>
/// <param name="Email">The shop's Contact email from the site settings; null when none is stored.</param>
public sealed record PrivacyContactDto(string? Email);
