using Csps.Domain.Common;

namespace Csps.Application.Images;

/// <summary>
/// The whole photo check before anything is sent to storage (IMG-02, D-34): the file is read by its first bytes, then its size in
/// bytes, its pixel count and its longest side are held against the limits. Width and height are the upright ones, so a sideways
/// phone photo (Exif orientation 5 to 8) is judged and stored the way it is shown.
/// </summary>
public static class ImageInspection
{
    /// <summary>Checks a file against the type and size rules.</summary>
    /// <param name="bytes">The whole file.</param>
    /// <param name="fileName">The name the client sent; only shown in a message.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>What the file is, or a 400 naming the file when it is not a photo we can use or is too large or too big.</returns>
    public static Result<ImageFacts> Check(ReadOnlyMemory<byte> bytes, string? fileName, ImageUploadSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        if (ImageSniffer.Inspect(bytes.Span) is not { } facts)
        {
            return Result.Failure<ImageFacts>(ImageErrors.Type(fileName));
        }

        if (bytes.Length > settings.MaxBytes)
        {
            return Result.Failure<ImageFacts>(ImageErrors.TooLarge(fileName, settings.MaxBytes));
        }

        var width = facts.UprightWidth;
        var height = facts.UprightHeight;
        if ((long)width * height > settings.MaxPixels || Math.Max(width, height) > settings.MaxSide)
        {
            return Result.Failure<ImageFacts>(ImageErrors.TooBig(fileName));
        }

        return Result.Success(facts);
    }
}
