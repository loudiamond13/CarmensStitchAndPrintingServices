using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>
/// The public site facts as one cached value: the typed data the page head and the JSON-LD are built from, and the JSON the API and
/// the boot data block send. Both come from the same read, so a page and the API never disagree.
/// </summary>
/// <param name="Site">The typed data.</param>
/// <param name="Json">The same data as JSON with its ETag.</param>
[ImmutableObject(true)]
public sealed record PublicSiteSnapshot(PublicSiteDto Site, PublicJsonSnapshot Json);
