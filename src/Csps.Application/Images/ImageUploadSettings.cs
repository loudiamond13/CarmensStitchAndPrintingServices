namespace Csps.Application.Images;

/// <summary>The fixed ceilings of a photo upload that configuration may lower but never raise (IMG-02).</summary>
public static class ImageUploadLimits
{
    /// <summary>The largest file the server accepts, in bytes: 10 MB.</summary>
    public const int MaxFileBytes = 10_485_760;

    /// <summary>The largest request body of an upload: the file plus room for the form fields and boundaries.</summary>
    public const int BodyBytes = MaxFileBytes + 65_536;
}

/// <summary>The configurable limits of a photo upload (section <c>Images</c>, IMG-02).</summary>
public sealed class ImageUploadSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Images";

    /// <summary>Gets or sets the largest file in bytes; from 1 to <see cref="ImageUploadLimits.MaxFileBytes"/>.</summary>
    public int MaxBytes { get; set; } = ImageUploadLimits.MaxFileBytes;

    /// <summary>Gets or sets the most pixels (width times height) a photo may have.</summary>
    public long MaxPixels { get; set; } = 25_000_000;

    /// <summary>Gets or sets the longest side in pixels.</summary>
    public int MaxSide { get; set; } = 10_000;

    /// <summary>Tells whether the values are usable.</summary>
    /// <returns>Null when they are, otherwise a plain message naming the first bad value.</returns>
    public string? Validate()
    {
        if (MaxBytes is < 1 or > ImageUploadLimits.MaxFileBytes)
        {
            return $"{SectionName}:MaxBytes must be from 1 to {ImageUploadLimits.MaxFileBytes}.";
        }

        if (MaxPixels < 1)
        {
            return $"{SectionName}:MaxPixels must be at least 1.";
        }

        return MaxSide < 1 ? $"{SectionName}:MaxSide must be at least 1." : null;
    }
}
