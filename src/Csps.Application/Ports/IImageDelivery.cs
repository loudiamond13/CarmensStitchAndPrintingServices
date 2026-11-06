using Csps.Application.Images;

namespace Csps.Application.Ports;

/// <summary>
/// Turns a stored photo into ready-to-use addresses (IMG-03, IMG-04, D-03). Only the allowed named sizes are used, so the
/// browser never builds an address and never loads a file larger than its slot.
/// </summary>
public interface IImageDelivery
{
    /// <summary>Builds the addresses of one photo on an order screen.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <returns>The thumb, viewer and full size addresses.</returns>
    PhotoUrls ForPhoto(string publicId, int width, int height);

    /// <summary>Builds the addresses of an order's cover photo for the list.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <returns>The card and table addresses.</returns>
    CoverUrls ForCover(string publicId, int width, int height);
}
