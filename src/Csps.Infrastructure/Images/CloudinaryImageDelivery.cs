using System.Text.RegularExpressions;
using Csps.Application.Images;
using Csps.Application.Ports;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>
/// Builds photo addresses from the named sizes (IMG-03, IMG-04, D-03). Pure string work: nothing here calls Cloudinary.
/// Every address is <c>https://res.cloudinary.com/{cloud}/image/private/t_{name}/v1/{publicId}</c>: the private type keeps the
/// original out of reach, the name is one of <see cref="ImageNamedSizes"/>, and <c>v1</c> stands in for the real upload version
/// so a purge of cached copies reaches every address (D-32). Without a cloud name every address is empty and one warning is logged,
/// so an order that has photos still reads; only the pictures are missing.
/// </summary>
/// <param name="options">The account settings.</param>
/// <param name="logger">The log; it receives a fixed sentence only.</param>
public sealed partial class CloudinaryImageDelivery(IOptions<CloudinarySettings> options, ILogger<CloudinaryImageDelivery> logger) : IImageDelivery
{
    private static readonly ImageSource NoSource = new(string.Empty, string.Empty);

    private readonly string _cloudName = options.Value.CloudName;
    private int _warned;

    /// <inheritdoc />
    public PhotoUrls ForPhoto(string publicId, int width, int height)
    {
        CheckInput(publicId, width, height);
        if (NoCloudName())
        {
            return new PhotoUrls(NoSource, NoSource, string.Empty);
        }

        return ImageCandidates.ForPhoto(width, height, size => Address(publicId, size));
    }

    /// <inheritdoc />
    public CoverUrls ForCover(string publicId, int width, int height)
    {
        CheckInput(publicId, width, height);
        if (NoCloudName())
        {
            return new CoverUrls(NoSource, NoSource);
        }

        return ImageCandidates.ForCover(width, height, size => Address(publicId, size));
    }

    private string Address(string publicId, ImageNamedSize size) =>
        $"https://res.cloudinary.com/{_cloudName}/image/private/t_{size.Name}/v1/{publicId}";

    private static void CheckInput(string publicId, int width, int height)
    {
        if (!PublicIdShape().IsMatch(publicId ?? string.Empty))
        {
            throw new ArgumentException("The public id must be lowercase letters, digits and hyphens in slash-separated folders.", nameof(publicId));
        }

        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(width);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(height);
    }

    private bool NoCloudName()
    {
        if (!string.IsNullOrEmpty(_cloudName))
        {
            return false;
        }

        if (Interlocked.Exchange(ref _warned, 1) == 0)
        {
            LogNoCloudName();
        }

        return true;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Cloudinary:CloudName is not set, so photo addresses are empty.")]
    private partial void LogNoCloudName();

    [GeneratedRegex("^[a-z0-9-]+(/[a-z0-9-]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex PublicIdShape();
}
