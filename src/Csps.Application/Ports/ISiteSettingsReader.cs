using Csps.Application.Content;

namespace Csps.Application.Ports;

/// <summary>Reads the SiteSettings singleton through a cache (FND-09, D-02).</summary>
public interface ISiteSettingsReader
{
    /// <summary>Returns the current settings; served from the cache until it is invalidated.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings snapshot.</returns>
    /// <exception cref="InvalidOperationException">The singleton row is missing (the migrations were not applied).</exception>
    ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken);
}
