using Microsoft.AspNetCore.Http;

namespace Csps.Server.Endpoints;

/// <summary>The public pages the server knows by path.</summary>
public enum PublicPage
{
    /// <summary>The Home page.</summary>
    Home,

    /// <summary>The Products page.</summary>
    Products,

    /// <summary>The Gallery page.</summary>
    Gallery,

    /// <summary>The Contact page.</summary>
    Contact,

    /// <summary>The Privacy Policy.</summary>
    Privacy,

    /// <summary>The Terms of Use.</summary>
    Terms,

    /// <summary>The Accessibility Statement.</summary>
    Accessibility,
}

/// <summary>What kind of path a request is.</summary>
public enum PublicRouteKind
{
    /// <summary>A known public page.</summary>
    Page,

    /// <summary>The admin app.</summary>
    Admin,

    /// <summary>A developer preview path.</summary>
    Dev,

    /// <summary>Nothing the site serves.</summary>
    NotFound,
}

/// <summary>The result of matching a path.</summary>
/// <param name="Kind">The kind of path.</param>
/// <param name="Page">The page, for <see cref="PublicRouteKind.Page"/>.</param>
/// <param name="CanonicalPath">The lower-case path without a trailing slash, for a page.</param>
public sealed record PublicRouteMatch(PublicRouteKind Kind, PublicPage? Page, string? CanonicalPath);

/// <summary>
/// The one list of paths the server answers as the site (PUB-01, PUB-04). It mirrors the client router: React Router
/// matches case-insensitively and tolerates one trailing slash, so the server does too, else it would send 404 for a
/// page the browser draws. <c>tests/fixtures/public-paths.json</c> holds the same page list for the client tests.
/// </summary>
public static class PublicRouteTable
{
    private const string AdminPrefix = "/admin";
    private const string DevPrefix = "/dev";

    private static readonly (string Path, PublicPage Page)[] Pages =
    [
        ("/", PublicPage.Home),
        ("/products", PublicPage.Products),
        ("/gallery", PublicPage.Gallery),
        ("/contact", PublicPage.Contact),
        ("/privacy", PublicPage.Privacy),
        ("/terms", PublicPage.Terms),
        ("/accessibility", PublicPage.Accessibility),
    ];

    /// <summary>Gets the known page paths, lower case, in sitemap order.</summary>
    public static IReadOnlyList<string> PagePaths { get; } = [.. Pages.Select(static entry => entry.Path)];

    /// <summary>Matches a request path: a page, the admin app, a dev preview path, or nothing.</summary>
    /// <param name="path">The request path.</param>
    /// <param name="devRoutesKnown">Whether the <c>/dev</c> preview paths exist in this environment.</param>
    /// <returns>The match. A page carries its lower-case canonical path, never the request's own text.</returns>
    public static PublicRouteMatch Match(PathString path, bool devRoutesKnown)
    {
        var value = path.Value;
        if (string.IsNullOrEmpty(value))
        {
            return new PublicRouteMatch(PublicRouteKind.Page, PublicPage.Home, "/");
        }

        var trimmed = value.Length > 1 && value[^1] == '/' ? value[..^1] : value;
        foreach (var (pagePath, page) in Pages)
        {
            if (string.Equals(trimmed, pagePath, StringComparison.OrdinalIgnoreCase))
            {
                return new PublicRouteMatch(PublicRouteKind.Page, page, pagePath);
            }
        }

        if (IsAtOrUnder(trimmed, AdminPrefix))
        {
            return new PublicRouteMatch(PublicRouteKind.Admin, null, null);
        }

        if (devRoutesKnown && IsAtOrUnder(trimmed, DevPrefix))
        {
            return new PublicRouteMatch(PublicRouteKind.Dev, null, null);
        }

        return new PublicRouteMatch(PublicRouteKind.NotFound, null, null);
    }

    private static bool IsAtOrUnder(string path, string prefix) =>
        path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
        && (path.Length == prefix.Length || path[prefix.Length] == '/');
}
