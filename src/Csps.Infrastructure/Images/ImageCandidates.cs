using System.Globalization;
using Csps.Application.Images;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The candidate rules shared by every image delivery (IMG-04): which named sizes a slot offers for a photo and how wide each
/// really is, so no candidate is larger than the photo. The delivery only decides what an address looks like.
/// </summary>
internal static class ImageCandidates
{
    /// <summary>Builds the thumb, viewer and full size sources of a photo on an order screen.</summary>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <param name="address">Makes the address of one named size.</param>
    /// <returns>The sources.</returns>
    public static PhotoUrls ForPhoto(int width, int height, Func<ImageNamedSize, string> address) =>
        new(
            Squares(width, height, ImageNamedSizes.SquareOf(88), ImageNamedSizes.SquareOf(176), address),
            Viewer(width, height, address),
            address(ImageNamedSizes.Full));

    /// <summary>Builds the card and table sources of an order's cover photo.</summary>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <param name="address">Makes the address of one named size.</param>
    /// <returns>The sources.</returns>
    public static CoverUrls ForCover(int width, int height, Func<ImageNamedSize, string> address) =>
        new(
            Card(width, height, address),
            Squares(width, height, ImageNamedSizes.SquareOf(44), ImageNamedSizes.SquareOf(88), address));

    /// <summary>Builds the category card, product large and product small sources and the 44 px thumb of a product line photo.</summary>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <param name="address">Makes the address of one named size.</param>
    /// <returns>The sources.</returns>
    public static LinePhotoUrls ForLinePhoto(int width, int height, Func<ImageNamedSize, string> address) =>
        new(
            Fill(ImageNamedSizes.CategoryCards, Math.Min(width, RoundHalfUp(height * 4L, 5)), preferredBox: 640, address),
            Limited(width, address),
            Fill(ImageNamedSizes.ProductSquares, Math.Min(width, height), preferredBox: 400, address),
            address(ImageNamedSizes.SquareOf(44)));

    /// <summary>Builds the masonry tile, lightbox and thumb sources of a public gallery photo.</summary>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <param name="address">Makes the address of one named size.</param>
    /// <returns>The sources.</returns>
    public static GalleryPhotoUrls ForGallery(int width, int height, Func<ImageNamedSize, string> address) =>
        new(
            Limited(width, address, [280, 400, 560, 800], preferredBox: 400),
            Viewer(width, height, address),
            address(ImageNamedSizes.SquareOf(88)));

    /// <summary>Builds the 4:5 strip tile sources of a Recent work photo.</summary>
    /// <param name="width">The stored upright width in pixels.</param>
    /// <param name="height">The stored upright height in pixels.</param>
    /// <param name="address">Makes the address of one named size.</param>
    /// <returns>The sources.</returns>
    public static ImageSource ForStrip(int width, int height, Func<ImageNamedSize, string> address) =>
        Fill(ImageNamedSizes.Strips, Math.Min(width, RoundHalfUp(height * 4L, 5)), preferredBox: 480, address);

    // The product large cell offers 400, 640, 800 and 1280 wide. The whole photo fits, so a candidate is never wider than the photo.
    private static ImageSource Limited(int width, Func<ImageNamedSize, string> address) =>
        Limited(width, address, [400, 640, 800, 1280], preferredBox: 800);

    private static ImageSource Limited(int width, Func<ImageNamedSize, string> address, int[] boxes, int preferredBox)
    {
        List<Candidate> candidates = [];
        foreach (var size in ImageNamedSizes.Widths.Where(size => boxes.Contains(size.BoxWidth)))
        {
            var atOrAbove = size.BoxWidth >= width;
            var trueWidth = atOrAbove ? width : size.BoxWidth;
            if (candidates.Count == 0 || candidates[^1].Width != trueWidth)
            {
                candidates.Add(new Candidate(address(size), trueWidth, size.BoxWidth));
            }

            if (atOrAbove)
            {
                break;
            }
        }

        return ToWidthSource(candidates, preferredBox);
    }

    // A fill crop is as wide as the box ratio allows from the photo; candidates stay within that width, and the smallest is always kept.
    private static ImageSource Fill(IReadOnlyList<ImageNamedSize> sizes, int cropWidth, int preferredBox, Func<ImageNamedSize, string> address)
    {
        List<Candidate> candidates =
        [
            .. sizes
                .Where(size => size.BoxWidth <= cropWidth)
                .Select(size => new Candidate(address(size), size.BoxWidth, size.BoxWidth)),
        ];
        if (candidates.Count == 0)
        {
            var smallest = sizes[0];
            candidates.Add(new Candidate(address(smallest), cropWidth, smallest.BoxWidth));
        }

        return ToWidthSource(candidates, preferredBox);
    }

    // A square slot crops the shorter side, so the 2x candidate exists only when that side can fill it.
    private static ImageSource Squares(int width, int height, ImageNamedSize oneX, ImageNamedSize twoX, Func<ImageNamedSize, string> address)
    {
        var first = address(oneX);
        if (Math.Min(width, height) < twoX.BoxWidth)
        {
            return new ImageSource(first, $"{first} 1x");
        }

        return new ImageSource(first, $"{first} 1x, {address(twoX)} 2x");
    }

    // The whole photo fits inside each box, so a candidate's true width is the photo width scaled by box / long side.
    // The first box at or above the long side ends the list, so no candidate is wider than the photo.
    private static ImageSource Viewer(int width, int height, Func<ImageNamedSize, string> address)
    {
        var longSide = Math.Max(width, height);
        List<Candidate> candidates = [];
        foreach (var size in ImageNamedSizes.Views)
        {
            var atOrAbove = size.BoxWidth >= longSide;
            var trueWidth = atOrAbove ? width : Math.Max(1, RoundHalfUp(size.BoxWidth * (long)width, longSide));
            if (candidates.Count == 0 || candidates[^1].Width != trueWidth)
            {
                candidates.Add(new Candidate(address(size), trueWidth, size.BoxWidth));
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
    private static ImageSource Card(int width, int height, Func<ImageNamedSize, string> address) =>
        Fill(ImageNamedSizes.Cards, Math.Min(width, RoundHalfUp(height * 16L, 10)), preferredBox: 640, address);

    // The fallback address is the preferred box when it is listed, otherwise the largest candidate.
    private static ImageSource ToWidthSource(List<Candidate> candidates, int preferredBox)
    {
        var src = (candidates.Find(candidate => candidate.Box == preferredBox) ?? candidates[^1]).Address;
        return new ImageSource(src, string.Join(", ", candidates.Select(candidate => $"{candidate.Address} {candidate.Width.ToString(CultureInfo.InvariantCulture)}w")));
    }

    // Rounds a positive ratio half away from zero without floating point.
    private static int RoundHalfUp(long numerator, long denominator) => (int)(((2 * numerator) + denominator) / (2 * denominator));

    private sealed record Candidate(string Address, int Width, int Box);
}
