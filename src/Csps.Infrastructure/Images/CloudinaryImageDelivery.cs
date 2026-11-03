using System.Globalization;
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
        return new PhotoUrls(
            Squares(publicId, width, height, ImageNamedSizes.SquareOf(88), ImageNamedSizes.SquareOf(176)),
            Viewer(publicId, width, height),
            Address(publicId, ImageNamedSizes.Full));
    }

    /// <inheritdoc />
    public CoverUrls ForCover(string publicId, int width, int height)
    {
        CheckInput(publicId, width, height);
        return new CoverUrls(
            Card(publicId, width, height),
            Squares(publicId, width, height, ImageNamedSizes.SquareOf(44), ImageNamedSizes.SquareOf(88)));
    }

    // A square slot crops the shorter side, so the 2x candidate exists only when that side can fill it.
    private ImageSource Squares(string publicId, int width, int height, ImageNamedSize oneX, ImageNamedSize twoX)
    {
        var first = Address(publicId, oneX);
        if (Math.Min(width, height) < twoX.BoxWidth)
        {
            return new ImageSource(first, $"{first} 1x");
        }

        return new ImageSource(first, $"{first} 1x, {Address(publicId, twoX)} 2x");
    }

    // The whole photo fits inside each box, so a candidate's true width is the photo width scaled by box / long side.
    // The first box at or above the long side ends the list, so no candidate is wider than the photo.
    private ImageSource Viewer(string publicId, int width, int height)
    {
        var longSide = Math.Max(width, height);
        List<Candidate> candidates = [];
        foreach (var size in ImageNamedSizes.Views)
        {
            var atOrAbove = size.BoxWidth >= longSide;
            var trueWidth = atOrAbove ? width : Math.Max(1, RoundHalfUp(size.BoxWidth * (long)width, longSide));
            if (candidates.Count == 0 || candidates[^1].Width != trueWidth)
            {
                candidates.Add(new Candidate(Address(publicId, size), trueWidth, size.BoxWidth));
            }

            if (atOrAbove)
            {
                break;
            }
        }

        return ToWidthSource(candidates, preferredBox: 960);
    }

    // A 16:10 crop is as wide as the photo, or 1.6 times its height when the photo is wider than 16:10.
    // Candidates stay within that width; the smallest is always kept and then reports the true width.
    private ImageSource Card(string publicId, int width, int height)
    {
        var cropWidth = Math.Min(width, RoundHalfUp(height * 16L, 10));
        List<Candidate> candidates =
        [
            .. ImageNamedSizes.Cards
                .Where(size => size.BoxWidth <= cropWidth)
                .Select(size => new Candidate(Address(publicId, size), size.BoxWidth, size.BoxWidth)),
        ];
        if (candidates.Count == 0)
        {
            var smallest = ImageNamedSizes.Cards[0];
            candidates.Add(new Candidate(Address(publicId, smallest), cropWidth, smallest.BoxWidth));
        }

        return ToWidthSource(candidates, preferredBox: 640);
    }

    // The fallback address is the preferred box when it is listed, otherwise the largest candidate.
    private static ImageSource ToWidthSource(List<Candidate> candidates, int preferredBox)
    {
        var src = (candidates.Find(candidate => candidate.Box == preferredBox) ?? candidates[^1]).Address;
        return new ImageSource(src, string.Join(", ", candidates.Select(candidate => $"{candidate.Address} {candidate.Width.ToString(CultureInfo.InvariantCulture)}w")));
    }

    // Rounds a positive ratio half away from zero without floating point.
    private static int RoundHalfUp(long numerator, long denominator) => (int)(((2 * numerator) + denominator) / (2 * denominator));

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

    private sealed record Candidate(string Address, int Width, int Box);

    [GeneratedRegex("^[a-z0-9-]+(/[a-z0-9-]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex PublicIdShape();
}
