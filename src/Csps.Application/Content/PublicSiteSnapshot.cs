using System.ComponentModel;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The public site facts as one cached value: the typed data the page head and the JSON-LD are built from, and the JSON the API and
/// the boot data block send. Both come from the same read, so a page and the API never disagree.
/// </summary>
/// <param name="Site">The typed data.</param>
/// <param name="Json">The same data as JSON with its ETag.</param>
/// <param name="Closures">The closures that touch the next 60 days, by first day: the open status skips them and the page head lists them as closed days.</param>
/// <param name="ShareImageUrl">
/// The address of the default link preview picture at 1200 x 630 (D-26), the one the Home, Contact and 404 heads carry and the Products and
/// Gallery heads fall back to; null when no picture is set or the image delivery has no address for it. It is a path on this site in the
/// Testing environment.
/// </param>
[ImmutableObject(true)]
public sealed record PublicSiteSnapshot(PublicSiteDto Site, PublicJsonSnapshot Json, IReadOnlyList<ClosureSpan> Closures, string? ShareImageUrl = null)
{
    /// <summary>Initializes a new instance of the <see cref="PublicSiteSnapshot"/> class with no closures.</summary>
    /// <param name="site">The typed data.</param>
    /// <param name="json">The same data as JSON with its ETag.</param>
    public PublicSiteSnapshot(PublicSiteDto site, PublicJsonSnapshot json)
        : this(site, json, [])
    {
    }
}
