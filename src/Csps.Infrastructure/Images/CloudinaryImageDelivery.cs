using System.Text.RegularExpressions;
using Csps.Application.Images;
using Csps.Application.Ports;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>
/// Builds photo addresses from the named sizes (IMG-03, IMG-04, D-03). Pure string work: nothing here calls Cloudinary.
/// Every address is <c>https://res.cloudinary.com/{cloud}/image/private/t_{name}/v1/{publicId}</c>: the private type keeps the
/// original out of reach, the name is one of <see cref="ImageNamedSizes"/>, and <c>v1</c> stands in for the real upload version
/// so a purge of cached copies reaches every address (D-32).
/// </summary>
public sealed partial class CloudinaryImageDelivery(IOptions<CloudinarySettings> options) : IImageDelivery
{
    private readonly string _cloudName = options.Value.CloudName;

    /// <inheritdoc />
    public PhotoUrls ForPhoto(string publicId, int width, int height)
    {
        CheckInput(publicId, width, height);
        return ImageCandidates.ForPhoto(width, height, size => Address(publicId, size));
    }

    /// <inheritdoc />
    public CoverUrls ForCover(string publicId, int width, int height)
    {
        CheckInput(publicId, width, height);
        return ImageCandidates.ForCover(width, height, size => Address(publicId, size));
    }

    private string Address(string publicId, ImageNamedSize size) =>
        $"https://res.cloudinary.com/{_cloudName}/image/private/t_{size.Name}/v1/{publicId}";

    private void CheckInput(string publicId, int width, int height)
    {
        if (string.IsNullOrEmpty(_cloudName))
        {
            throw new InvalidOperationException("Cloudinary:CloudName is not set, so photo addresses cannot be built.");
        }

        if (!PublicIdShape().IsMatch(publicId ?? string.Empty))
        {
            throw new ArgumentException("The public id must be lowercase letters, digits and hyphens in slash-separated folders.", nameof(publicId));
        }

        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(width);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(height);
    }

    [GeneratedRegex("^[a-z0-9-]+(/[a-z0-9-]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex PublicIdShape();
}
