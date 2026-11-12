using Csps.Application.Content;
using Csps.Application.Ports;
using Microsoft.Extensions.Caching.Hybrid;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Clears the public cache by tag. The site settings are cleared with it, because the business calendar reads the time zone through
/// them and a settings save may change it.
/// </summary>
/// <param name="cache">The in-process cache.</param>
internal sealed class PublicContentCache(HybridCache cache) : IPublicContentCache
{
    private static readonly string[] Tags = [PublicCacheTags.PublicContent, SiteSettingsReader.CacheTag];

    public ValueTask InvalidateAsync(CancellationToken cancellationToken) => cache.RemoveByTagAsync(Tags, cancellationToken);
}
