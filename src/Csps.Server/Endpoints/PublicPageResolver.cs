using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Microsoft.AspNetCore.Http;

namespace Csps.Server.Endpoints;

/// <summary>
/// Answers <see cref="IPublicPageResolver"/> with the server's route table (ANL-05, T-12-29): a known page gives its key, any other public
/// path folds into <c>not-found</c>, and an admin or developer path gives nothing. Only these eight keys can ever reach the counts.
/// </summary>
/// <param name="environment">The host environment, which decides whether the developer preview paths exist.</param>
public sealed class PublicPageResolver(IHostEnvironment environment) : IPublicPageResolver
{
    /// <inheritdoc />
    public string? PageKeyFor(string cutPath)
    {
        ArgumentNullException.ThrowIfNull(cutPath);

        var devRoutesKnown = environment.IsDevelopment() || environment.IsEnvironment("Testing");
        var match = PublicRouteTable.Match(new PathString(WithoutTrailingSlashes(cutPath)), devRoutesKnown);
        return match.Kind switch
        {
            PublicRouteKind.Page => KeyOf(match.Page!.Value),
            PublicRouteKind.NotFound => PageKeys.NotFound,
            _ => null,
        };
    }

    // The client router draws a page under any number of trailing slashes (web/src/utils/urlPath.ts), so the count does too. Only the
    // count: the HTML shell keeps its one-slash match, so `/privacy//` still answers 404 there.
    private static string WithoutTrailingSlashes(string path)
    {
        var trimmed = path.TrimEnd('/');
        return trimmed.Length == 0 ? "/" : trimmed;
    }

    private static string KeyOf(PublicPage page) => page switch
    {
        PublicPage.Home => PageKeys.Home,
        PublicPage.Products => PageKeys.Products,
        PublicPage.Gallery => PageKeys.Gallery,
        PublicPage.Contact => PageKeys.Contact,
        PublicPage.Privacy => PageKeys.Privacy,
        PublicPage.Terms => PageKeys.Terms,
        PublicPage.Accessibility => PageKeys.Accessibility,
        _ => throw new ArgumentOutOfRangeException(nameof(page), page, "Unknown public page."),
    };
}
