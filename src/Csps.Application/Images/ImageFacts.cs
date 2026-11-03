namespace Csps.Application.Images;

/// <summary>What the first bytes of a photo say about it, read without decoding (IMG-02, IMG-03).</summary>
/// <param name="Kind">The format.</param>
/// <param name="Width">The stored width in pixels, before any rotation.</param>
/// <param name="Height">The stored height in pixels, before any rotation.</param>
/// <param name="Orientation">The Exif orientation from 1 to 8; 1 when the file has none.</param>
public sealed record ImageFacts(ImageKind Kind, int Width, int Height, int Orientation)
{
    /// <summary>Gets the width as the photo is shown: width and height swap for the sideways orientations 5 to 8.</summary>
    public int UprightWidth => Orientation >= 5 ? Height : Width;

    /// <summary>Gets the height as the photo is shown.</summary>
    public int UprightHeight => Orientation >= 5 ? Width : Height;
}
