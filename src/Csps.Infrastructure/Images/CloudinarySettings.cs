namespace Csps.Infrastructure.Images;

/// <summary>Where order photos live in the Cloudinary account (IMG-03, D-07).</summary>
public sealed class CloudinarySettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Cloudinary";

    /// <summary>Gets or sets the account's cloud name.</summary>
    public string CloudName { get; set; } = string.Empty;

    /// <summary>Gets or sets the API key.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Gets or sets the API secret.</summary>
    public string ApiSecret { get; set; } = string.Empty;

    /// <summary>Gets or sets the root folder of this environment's photos.</summary>
    public string RootFolder { get; set; } = string.Empty;
}
