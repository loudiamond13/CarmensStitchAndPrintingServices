namespace Csps.Server.Endpoints;

/// <summary>A page's document title and meta description.</summary>
/// <param name="Title">The <c>title</c> text.</param>
/// <param name="Description">The meta description.</param>
internal sealed record PageHead(string Title, string Description);

/// <summary>
/// The title and description each public page sends in its first response (UI-SPEC Document titles and Meta
/// descriptions). The client sets the same strings on navigation. Home's description is the stored tagline.
/// </summary>
internal static class PublicPageHeads
{
    private const string HomeTitle = "CSPS · Custom Team Jerseys and Tailoring";

    private static readonly PageHead Products = new(
        "Products and Prices · CSPS",
        "See our product lines, starting prices and everything you can customize, from fabric to names and numbers.");

    private static readonly PageHead Gallery = new(
        "Our Work · Gallery · CSPS",
        "Photos of real team orders from leagues, schools, riding clubs and offices.");

    private static readonly PageHead Contact = new(
        "Contact Us and Get a Quote · CSPS",
        "Message us on Messenger or call the shop. See our hours, address and map.");

    private static readonly PageHead Privacy = new(
        "Privacy Policy · CSPS",
        "How we collect, use and protect your personal information, and your rights under the Data Privacy Act of 2012.");

    /// <summary>Gets the head of the 404 page.</summary>
    public static PageHead NotFound { get; } = new("Page Not Found · CSPS", "This page couldn't be found.");

    /// <summary>Returns the head of a public page.</summary>
    /// <param name="page">The page.</param>
    /// <param name="tagline">The stored tagline, which is Home's description.</param>
    /// <returns>Its title and description.</returns>
    public static PageHead For(PublicPage page, string tagline) => page switch
    {
        PublicPage.Home => new PageHead(HomeTitle, tagline),
        PublicPage.Products => Products,
        PublicPage.Gallery => Gallery,
        PublicPage.Contact => Contact,
        PublicPage.Privacy => Privacy,
        _ => throw new ArgumentOutOfRangeException(nameof(page), page, "Unknown public page."),
    };
}
