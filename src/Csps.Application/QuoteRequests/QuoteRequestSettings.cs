namespace Csps.Application.QuoteRequests;

/// <summary>The configurable limits of the quote form (section <c>QuoteRequests</c>, INQ-02).</summary>
public sealed class QuoteRequestSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "QuoteRequests";

    /// <summary>The shortest upload key lifetime.</summary>
    public static readonly TimeSpan MinUploadKeyLifetime = TimeSpan.FromMinutes(5);

    /// <summary>The longest upload key lifetime.</summary>
    public static readonly TimeSpan MaxUploadKeyLifetime = TimeSpan.FromHours(24);

    /// <summary>Gets or sets how long a visitor's upload key works after the request is saved; from 5 minutes to 24 hours.</summary>
    public TimeSpan UploadKeyLifetime { get; set; } = TimeSpan.FromHours(2);

    /// <summary>Tells whether the values are usable.</summary>
    /// <returns>Null when they are, otherwise a plain message naming the first bad value.</returns>
    public string? Validate() =>
        UploadKeyLifetime < MinUploadKeyLifetime || UploadKeyLifetime > MaxUploadKeyLifetime
            ? $"{SectionName}:UploadKeyLifetime must be from 5 minutes to 24 hours."
            : null;
}
