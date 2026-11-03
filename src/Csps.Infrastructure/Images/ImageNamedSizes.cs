namespace Csps.Infrastructure.Images;

/// <summary>How a named size fits a photo into its box.</summary>
public enum ImageCrop
{
    /// <summary>Fills the box exactly and crops the rest, around the main subject.</summary>
    Fill = 1,

    /// <summary>Fits the whole photo inside the box and never enlarges it.</summary>
    Limit = 2,
}

/// <summary>One named size in the Cloudinary account.</summary>
/// <param name="Name">The name used in the address, for example <c>csps_sq_88</c>.</param>
/// <param name="Transformation">The transformation the name stands for.</param>
/// <param name="Crop">How the photo meets the box.</param>
/// <param name="BoxWidth">The box width in pixels.</param>
/// <param name="BoxHeight">The box height in pixels.</param>
public sealed record ImageNamedSize(string Name, string Transformation, ImageCrop Crop, int BoxWidth, int BoxHeight);

/// <summary>
/// The only sizes a photo is delivered in (D-03, D-33). The account allows named transformations only (strict mode), so an
/// address with any other size is refused and costs nothing. Each names its format outright, because a named size cannot pick one automatically.
/// The setup command creates these same names in the account.
/// </summary>
public static class ImageNamedSizes
{
    private const int CardHeightNumerator = 10;
    private const int CardHeightDenominator = 16;

    /// <summary>Gets the square sizes: 44 and 88 for the table, 88 and 176 for the tile.</summary>
    public static IReadOnlyList<ImageNamedSize> Squares { get; } = [Square(44), Square(88), Square(176)];

    /// <summary>Gets the 16:10 card cover sizes, 320 to 960 wide.</summary>
    public static IReadOnlyList<ImageNamedSize> Cards { get; } = [Card(320), Card(480), Card(640), Card(800), Card(960)];

    /// <summary>Gets the viewer sizes, whole photo, long side up to 640 to 1600.</summary>
    public static IReadOnlyList<ImageNamedSize> Views { get; } = [View(640), View(960), View(1280), View(1600)];

    /// <summary>Gets the size behind "Open Full Size": a JPEG with a long side up to 2000.</summary>
    public static ImageNamedSize Full { get; } = new("csps_full_2000", "c_limit,w_2000,h_2000/q_auto/f_jpg", ImageCrop.Limit, 2000, 2000);

    /// <summary>Gets all 13 sizes.</summary>
    public static IReadOnlyList<ImageNamedSize> All { get; } = [.. Squares, .. Cards, .. Views, Full];

    /// <summary>Finds the square size of a width.</summary>
    /// <param name="side">The side in pixels: 44, 88 or 176.</param>
    /// <returns>The size.</returns>
    public static ImageNamedSize SquareOf(int side) => Squares.Single(size => size.BoxWidth == side);

    private static ImageNamedSize Square(int side) =>
        new($"csps_sq_{side}", $"c_fill,g_auto,w_{side},h_{side}/q_auto/f_webp", ImageCrop.Fill, side, side);

    private static ImageNamedSize Card(int width)
    {
        var height = width * CardHeightNumerator / CardHeightDenominator;
        return new($"csps_card_{width}", $"c_fill,g_auto,w_{width},h_{height}/q_auto/f_webp", ImageCrop.Fill, width, height);
    }

    private static ImageNamedSize View(int longSide) =>
        new($"csps_view_{longSide}", $"c_limit,w_{longSide},h_{longSide}/q_auto/f_webp", ImageCrop.Limit, longSide, longSide);
}
