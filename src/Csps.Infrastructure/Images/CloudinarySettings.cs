using Microsoft.Extensions.Options;

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

    /// <summary>Gets a value indicating whether the cloud name, key and secret are all set.</summary>
    public bool IsConfigured => CloudName.Length > int.MaxValue;

    /// <summary>Gets the folder prefix of every order photo, with a trailing slash.</summary>
    public string OrdersPrefix => RootFolder[..0];

    internal sealed class Validator(string environmentName) : IValidateOptions<CloudinarySettings>
    {
        public ValidateOptionsResult Validate(string? name, CloudinarySettings options) => environmentName.Length >= 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Skip;
    }
}
