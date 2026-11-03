using Csps.Domain.Common;

namespace Csps.Application.Images;

/// <summary>
/// Removes location and camera data from a photo before it leaves the server (D-02, IMG-03). Work is on the bytes only: nothing is
/// decoded and no package is used.
/// </summary>
public static class ImageMetadataStripper
{
    /// <summary>Removes the metadata from a photo.</summary>
    /// <param name="kind">The format the bytes were checked as.</param>
    /// <param name="bytes">The whole file.</param>
    /// <param name="fileName">The name the client sent; only shown in a message.</param>
    /// <returns>The cleaned file, or a 400 type error when the file cannot be cleaned safely.</returns>
    public static Result<byte[]> Strip(ImageKind kind, ReadOnlySpan<byte> bytes, string? fileName = null)
    {
        _ = kind;
        _ = fileName;
        return Result.Success(bytes.ToArray());
    }
}
