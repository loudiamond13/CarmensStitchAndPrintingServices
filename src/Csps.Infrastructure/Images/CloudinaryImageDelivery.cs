using Csps.Application.Images;
using Csps.Application.Ports;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>Builds photo addresses from the named sizes (IMG-03, IMG-04).</summary>
/// <param name="options">The Cloudinary settings.</param>
public sealed class CloudinaryImageDelivery(IOptions<CloudinarySettings> options) : IImageDelivery
{
    private readonly CloudinarySettings _settings = options.Value;

    /// <inheritdoc />
    public PhotoUrls ForPhoto(string publicId, int width, int height) =>
        new(new ImageSource(string.Empty, string.Empty), new ImageSource(string.Empty, string.Empty), string.Empty);

    /// <inheritdoc />
    public CoverUrls ForCover(string publicId, int width, int height) =>
        new(new ImageSource(string.Empty, string.Empty), new ImageSource(string.Empty, string.Empty));
}
