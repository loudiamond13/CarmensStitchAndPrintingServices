namespace Csps.Application.Ports;

/// <summary>
/// Invalidates the cached SiteSettings. Call it after every SiteSettings save (CONT-01) so the next read
/// returns the committed values (D-02).
/// </summary>
public interface ISiteSettingsCache
{
    /// <summary>Discards the cached settings; the next read goes to the database.</summary>
    /// <param name="cancellationToken">Cancels the invalidation.</param>
    /// <returns>A task that completes when the cache entry is invalid.</returns>
    ValueTask InvalidateAsync(CancellationToken cancellationToken);
}
