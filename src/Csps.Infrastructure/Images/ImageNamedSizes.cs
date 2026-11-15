namespace Csps.Infrastructure.Images;

/// <summary>How a named size fits a photo into its box.</summary>
public enum ImageCrop
{
    /// <summary>Fills the box exactly and crops the rest. The transformation says where the cut falls: g_auto keeps the main subject, g_center the middle.</summary>
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
    private const int PortraitHeightNumerator = 5;
    private const int PortraitHeightDenominator = 4;
    private const string SmartCrop = "g_auto";
    private const string CentreCrop = "g_center";
    private const string WebP = "f_webp";
    private const string Jpeg = "f_jpg";

    /// <summary>Gets the square sizes: 44 and 88 for the table, 88 and 176 for the tile.</summary>
    public static IReadOnlyList<ImageNamedSize> Squares { get; } = [Square(44), Square(88), Square(176)];

    /// <summary>Gets the 16:10 card cover sizes, 320 to 960 wide.</summary>
    public static IReadOnlyList<ImageNamedSize> Cards { get; } = [Card(320), Card(480), Card(640), Card(800), Card(960)];

    /// <summary>Gets the viewer sizes, whole photo, long side up to 640 to 1600.</summary>
    public static IReadOnlyList<ImageNamedSize> Views { get; } = [View(640), View(960), View(1280), View(1600)];

    /// <summary>Gets the size behind "Open Full Size": a JPEG with a long side up to 2000.</summary>
    public static ImageNamedSize Full { get; } = new("csps_full_2000", "c_limit,w_2000,h_2000/q_auto/f_jpg", ImageCrop.Limit, 2000, 2000);

    /// <summary>Gets the 4:5 category card sizes, 320 to 960 wide, cut from the centre (D-130).</summary>
    public static IReadOnlyList<ImageNamedSize> CategoryCards { get; } =
        [Portrait("csps_catc_", CentreCrop, 320), Portrait("csps_catc_", CentreCrop, 480), Portrait("csps_catc_", CentreCrop, 640), Portrait("csps_catc_", CentreCrop, 800), Portrait("csps_catc_", CentreCrop, 960)];

    /// <summary>Gets the 4:5 strip tile sizes, 240 to 1060 wide, cut from the centre (D-130).</summary>
    public static IReadOnlyList<ImageNamedSize> Strips { get; } =
        [Portrait("csps_stripc_", CentreCrop, 240), Portrait("csps_stripc_", CentreCrop, 480), Portrait("csps_stripc_", CentreCrop, 720), Portrait("csps_stripc_", CentreCrop, 1060)];

    /// <summary>
    /// Gets the width-limited sizes, 280 to 1280 wide, for the masonry tiles and the product large cell. The width is limited and the
    /// height follows, so a size has no box height (Phase 11).
    /// </summary>
    public static IReadOnlyList<ImageNamedSize> Widths { get; } = [Width(280), Width(400), Width(560), Width(640), Width(800), Width(1280)];

    /// <summary>Gets the 1:1 product small cell sizes: 200, 400 and 720, cut from the centre (D-130).</summary>
    public static IReadOnlyList<ImageNamedSize> ProductSquares { get; } =
        [FillSize("csps_psqc_200", CentreCrop, 200, 200, WebP), FillSize("csps_psqc_400", CentreCrop, 400, 400, WebP), FillSize("csps_psqc_720", CentreCrop, 720, 720, WebP)];

    /// <summary>Gets the 1200 x 630 link preview size, cut from the centre (D-130). A JPEG because scrapers do not all read WebP.</summary>
    public static ImageNamedSize Share { get; } = FillSize("csps_sharec_1200", CentreCrop, 1200, 630, Jpeg);

    /// <summary>Gets the 1.91:1 link preview sizes of the admin screen: 320 x 168 and 640 x 336, cut from the centre (D-130).</summary>
    public static IReadOnlyList<ImageNamedSize> SharePreviews { get; } =
        [SharePreview("csps_sharec_", CentreCrop, 320, 168), SharePreview("csps_sharec_", CentreCrop, 640, 336)];

    /// <summary>Finds the admin link preview size of a width.</summary>
    /// <param name="width">The width in pixels: 320 or 640.</param>
    /// <returns>The size.</returns>
    public static ImageNamedSize SharePreviewOf(int width) => SharePreviews.Single(size => size.BoxWidth == width);

    /// <summary>
    /// Gets the 21 sizes Phase 11 adds. They stay in the account so addresses already handed out keep working, but the site no longer
    /// selects the 15 smart-crop fills among them; it uses <see cref="CentreCuts"/> instead (D-130).
    /// </summary>
    public static IReadOnlyList<ImageNamedSize> Phase11 { get; } =
    [
        Portrait("csps_cat_", SmartCrop, 320), Portrait("csps_cat_", SmartCrop, 480), Portrait("csps_cat_", SmartCrop, 640), Portrait("csps_cat_", SmartCrop, 800), Portrait("csps_cat_", SmartCrop, 960),
        Portrait("csps_strip_", SmartCrop, 240), Portrait("csps_strip_", SmartCrop, 480), Portrait("csps_strip_", SmartCrop, 720), Portrait("csps_strip_", SmartCrop, 1060),
        .. Widths,
        Square(200), Square(400), Square(720),
        FillSize("csps_share_1200", SmartCrop, 1200, 630, Jpeg),
        SharePreview("csps_share_", SmartCrop, 320, 168), SharePreview("csps_share_", SmartCrop, 640, 336),
    ];

    /// <summary>Gets the 15 public fill sizes that cut from the centre (D-130): category cards, strips, product squares, share and share previews.</summary>
    public static IReadOnlyList<ImageNamedSize> CentreCuts { get; } = [.. CategoryCards, .. Strips, .. ProductSquares, Share, .. SharePreviews];

    /// <summary>Gets all 49 sizes: the 13 of Phase 9, the 21 of Phase 11, then the 15 centre cuts. The setup command creates the ones the account lacks.</summary>
    public static IReadOnlyList<ImageNamedSize> All { get; } = [.. Squares, .. Cards, .. Views, Full, .. Phase11, .. CentreCuts];

    /// <summary>Finds the square size of a width.</summary>
    /// <param name="side">The side in pixels: 44, 88 or 176.</param>
    /// <returns>The size.</returns>
    public static ImageNamedSize SquareOf(int side) => Squares.Single(size => size.BoxWidth == side);

    /// <summary>Finds the width-limited size of a width.</summary>
    /// <param name="width">The width in pixels: 280, 400, 560, 640, 800 or 1280.</param>
    /// <returns>The size.</returns>
    public static ImageNamedSize WidthOf(int width) => Widths.Single(size => size.BoxWidth == width);

    private static ImageNamedSize FillSize(string name, string gravity, int width, int height, string format) =>
        new(name, $"c_fill,{gravity},w_{width},h_{height}/q_auto/{format}", ImageCrop.Fill, width, height);

    private static ImageNamedSize Square(int side) => FillSize($"csps_sq_{side}", SmartCrop, side, side, WebP);

    private static ImageNamedSize Card(int width) =>
        FillSize($"csps_card_{width}", SmartCrop, width, width * CardHeightNumerator / CardHeightDenominator, WebP);

    // 4:5 fill: the height is one and a quarter times the width.
    private static ImageNamedSize Portrait(string prefix, string gravity, int width) =>
        FillSize($"{prefix}{width}", gravity, width, width * PortraitHeightNumerator / PortraitHeightDenominator, WebP);

    private static ImageNamedSize Width(int width) =>
        new($"csps_w_{width}", $"c_limit,w_{width}/q_auto/f_webp", ImageCrop.Limit, width, 0);

    private static ImageNamedSize SharePreview(string prefix, string gravity, int width, int height) =>
        FillSize($"{prefix}{width}", gravity, width, height, WebP);

    private static ImageNamedSize View(int longSide) =>
        new($"csps_view_{longSide}", $"c_limit,w_{longSide},h_{longSide}/q_auto/f_webp", ImageCrop.Limit, longSide, longSide);
}
