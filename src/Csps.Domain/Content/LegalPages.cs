namespace Csps.Domain.Content;

/// <summary>The facts of one legal page (LEGAL-05, D-10, D-14).</summary>
/// <param name="Key">The page key: privacy, cookies, terms or accessibility.</param>
/// <param name="Path">The public path, lower case.</param>
/// <param name="Version">The version, such as 0.1.</param>
/// <param name="LastUpdated">The date of the last change to the text.</param>
/// <param name="Approved">Whether the owner approved the text. While false the page is a draft: noindex and out of the sitemap.</param>
public sealed record LegalPageFacts(string Key, string Path, string Version, DateOnly LastUpdated, bool Approved);

/// <summary>
/// The four legal pages' facts in code (D-10, D-22). They equal <c>tests/fixtures/legal-pages.json</c> and the web copy, and tests
/// fail when they drift. The Cookie Policy's version is the consent policy version.
/// </summary>
public static class LegalPages
{
    /// <summary>Gets the Privacy Policy.</summary>
    public static LegalPageFacts Privacy { get; } = new("privacy", "/privacy", "1.0", new DateOnly(2026, 11, 18), Approved: true);

    /// <summary>Gets the Cookie Policy.</summary>
    public static LegalPageFacts Cookies { get; } = new("cookies", "/cookies", "1.0", new DateOnly(2026, 11, 18), Approved: true);

    /// <summary>Gets the Terms of Use.</summary>
    public static LegalPageFacts Terms { get; } = new("terms", "/terms", "1.0", new DateOnly(2026, 11, 18), Approved: true);

    /// <summary>Gets the Accessibility Statement.</summary>
    public static LegalPageFacts Accessibility { get; } = new("accessibility", "/accessibility", "1.0", new DateOnly(2026, 11, 18), Approved: true);

    /// <summary>Gets all four pages, in route order.</summary>
    public static IReadOnlyList<LegalPageFacts> All { get; } = [Privacy, Cookies, Terms, Accessibility];

    /// <summary>Gets the consent policy version: a new version asks every visitor again (D-22).</summary>
    public static string CookiePolicyVersion => Cookies.Version;

    /// <summary>Finds a page by its public path.</summary>
    /// <param name="path">The lower-case path, such as <c>/privacy</c>.</param>
    /// <returns>The page, or null when the path is not a legal page.</returns>
    public static LegalPageFacts? ByPath(string path) =>
        All.FirstOrDefault(page => string.Equals(page.Path, path, StringComparison.Ordinal));
}
