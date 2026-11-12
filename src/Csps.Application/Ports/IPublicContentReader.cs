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

    /// <summary>Returns the shown product lines in display order; served from the cache until a content change clears it.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot; its list is empty when no line is shown.</returns>
    ValueTask<PublicProductLinesSnapshot> GetProductLinesAsync(CancellationToken cancellationToken);

    /// <summary>Returns what the Home page shows: the line cards and the first three shown testimonials; served from the cache until a content change clears it.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    ValueTask<PublicHomeSnapshot> GetHomeAsync(CancellationToken cancellationToken);

    /// <summary>Returns the Gallery: every public item in gallery order with the pill counts; served from the cache until a content change clears it.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot; its lists are empty when nothing is public.</returns>
    ValueTask<PublicGallerySnapshot> GetGalleryAsync(CancellationToken cancellationToken);
}
