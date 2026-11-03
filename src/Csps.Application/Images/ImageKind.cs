namespace Csps.Application.Images;

/// <summary>The photo formats an order accepts, told apart by their first bytes (IMG-02).</summary>
public enum ImageKind
{
    /// <summary>A JPEG file.</summary>
    Jpeg = 1,

    /// <summary>A PNG file.</summary>
    Png = 2,

    /// <summary>A WebP file.</summary>
    WebP = 3,

    /// <summary>A HEIC file.</summary>
    Heic = 4,
}

/// <summary>The short names the stored <c>Format</c> column uses for each <see cref="ImageKind"/>.</summary>
public static class ImageKinds
{
    /// <summary>Gets the stored name of a format.</summary>
    /// <param name="kind">The format.</param>
    /// <returns><c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The value is not a known format.</exception>
    public static string Key(ImageKind kind) => kind switch
    {
        ImageKind.Jpeg => "jpg",
        ImageKind.Png => "png",
        ImageKind.WebP => "webp",
        ImageKind.Heic => "heic",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown image format."),
    };
}
