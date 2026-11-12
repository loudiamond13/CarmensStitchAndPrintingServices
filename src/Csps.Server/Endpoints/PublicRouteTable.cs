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

/// <summary>Skeleton: replaced by the implementation in the next commit.</summary>
public static class PublicRouteTable
{
    /// <summary>Gets the known page paths.</summary>
    public static IReadOnlyList<string> PagePaths { get; } = [];

    /// <summary>Matches a request path.</summary>
    /// <param name="path">The request path.</param>
    /// <param name="devRoutesKnown">Whether dev paths exist in this environment.</param>
    /// <returns>The match.</returns>
    public static PublicRouteMatch Match(PathString path, bool devRoutesKnown) =>
        new(PublicRouteKind.NotFound, null, null);
}
