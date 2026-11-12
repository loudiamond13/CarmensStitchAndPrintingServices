namespace Csps.Server.Endpoints;

/// <summary>A page's document title and meta description.</summary>
/// <param name="Title">The <c>title</c> text.</param>
/// <param name="Description">The meta description.</param>
internal sealed record PageHead(string Title, string Description);

/// <summary>
/// The title and description each public page sends in its first response (UI-SPEC Document titles and Meta
/// descriptions). The client sets the same strings on navigation. Home's description is the approved tagline until the
/// stored one is read.
/// </summary>
internal static class PublicPageHeads
{
    /// <summary>The approved shop tagline.</summary>
    public const string HomeTagline = "Custom tailoring and full-sublimation printing for teams, leagues and riding groups.";

    private static readonly PageHead Home = new("CSPS · Custom Team Jerseys and Tailoring", HomeTagline);

    private static readonly PageHead Products = new(
        "Products and Prices · CSPS",
        "See our product lines, starting prices and everything you can customize, from fabric to names and numbers.");

    private static readonly PageHead Gallery = new(
        "Our Work · Gallery · CSPS",
        "Photos of real team orders from leagues, schools, riding clubs and offices.");

    private static readonly PageHead Contact = new(
        "Contact Us and Get a Quote · CSPS",
        "Message us on Messenger or call the shop. See our hours, address and map.");

    /// <summary>Gets the head of the 404 page.</summary>
    public static PageHead NotFound { get; } = new("Page Not Found · CSPS", "This page couldn't be found.");

    /// <summary>Returns the head of a public page.</summary>
    /// <param name="page">The page.</param>
    /// <returns>Its title and description.</returns>
    public static PageHead For(PublicPage page) => page switch
    {
        PublicPage.Home => Home,
        PublicPage.Products => Products,
        PublicPage.Gallery => Gallery,
        PublicPage.Contact => Contact,
        _ => throw new ArgumentOutOfRangeException(nameof(page), page, "Unknown public page."),
    };
}
