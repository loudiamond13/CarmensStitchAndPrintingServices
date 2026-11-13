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

    /// <summary>Builds the addresses of a product line photo for the public pages and the admin screens.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <returns>The card, large and small candidates and the 44 px thumb.</returns>
    LinePhotoUrls ForLinePhoto(string publicId, int width, int height);

    /// <summary>Builds the addresses of a photo in the public Gallery: the masonry tile, the lightbox and its thumb.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <returns>The masonry and viewer candidates and the thumb address; every address is empty when the account has no cloud name set.</returns>
    GalleryPhotoUrls ForGallery(string publicId, int width, int height);

    /// <summary>Builds the addresses of a photo as a tile of the Home page's Recent work strip, at the 4:5 strip sizes.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <returns>The strip candidates; empty when the account has no cloud name set.</returns>
    ImageSource ForStrip(string publicId, int width, int height);

    /// <summary>Builds the one address of a photo as a 1200 x 630 link preview picture.</summary>
    /// <param name="publicId">The stored public id.</param>
    /// <returns>The address, or an empty text when the account has no cloud name set. In the Testing environment it is a path on this site.</returns>
    string ForShare(string publicId);
}
