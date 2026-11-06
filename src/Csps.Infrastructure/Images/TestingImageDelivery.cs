#if CSPS_TESTING
using Csps.Application.Images;
using Csps.Application.Ports;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The Testing environment's image delivery (D-07): same-origin addresses <c>/api/testing/images/{id}?size={name}</c> with the same
/// candidate widths as Cloudinary, so tests and end-to-end runs never call it. The id is the last segment of the public id.
/// It exists only in Debug builds (QUAL-05).
/// </summary>
public sealed class TestingImageDelivery : IImageDelivery
{
    private const string Route = "/api/testing/images/";

    /// <inheritdoc />
    public PhotoUrls ForPhoto(string publicId, int width, int height)
    {
        var id = IdOf(publicId);
        return ImageCandidates.ForPhoto(width, height, size => Address(id, size));
    }

    /// <inheritdoc />
    public CoverUrls ForCover(string publicId, int width, int height)
    {
        var id = IdOf(publicId);
        return ImageCandidates.ForCover(width, height, size => Address(id, size));
    }

    private static string IdOf(string publicId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(publicId);
        return publicId[(publicId.LastIndexOf('/') + 1)..];
    }

    private static string Address(string id, ImageNamedSize size) => $"{Route}{id}?size={size.Name}";
}
#endif
