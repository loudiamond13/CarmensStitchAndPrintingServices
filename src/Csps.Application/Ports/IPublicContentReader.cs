using Csps.Application.Content;

namespace Csps.Application.Ports;

/// <summary>Reads what the public site shows, from one cache that every content write clears (PUB-03, CONT-05).</summary>
public interface IPublicContentReader
{
    /// <summary>Returns the public site facts; served from the cache until a content change clears it.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    /// <exception cref="InvalidOperationException">The site settings row is missing (the migrations were not applied).</exception>
    ValueTask<PublicSiteSnapshot> GetSiteAsync(CancellationToken cancellationToken);
}
