using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>Where order photos live in the Cloudinary account (IMG-03, D-07).</summary>
public sealed partial class CloudinarySettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Cloudinary";

    /// <summary>The root folder of the live photos. Only Production may use it.</summary>
    public const string LiveRootFolder = "csps";

    /// <summary>The root folder every other environment is expected to use.</summary>
    public const string DevRootFolder = "csps-dev";

    /// <summary>Gets or sets the account's cloud name.</summary>
    public string CloudName { get; set; } = string.Empty;

    /// <summary>Gets or sets the API key.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Gets or sets the API secret.</summary>
    public string ApiSecret { get; set; } = string.Empty;

    /// <summary>Gets or sets the root folder of this environment's photos.</summary>
    public string RootFolder { get; set; } = string.Empty;

    /// <summary>Gets a value indicating whether the cloud name, key and secret are all set.</summary>
    public bool IsConfigured => CloudName.Length > 0 && ApiKey.Length > 0 && ApiSecret.Length > 0;

    /// <summary>
    /// Gets the folder prefix of every order photo. The trailing slash matters: <c>csps</c> is the start of <c>csps-dev</c>,
    /// and only the slash keeps one environment's prefix from matching the other's photos.
    /// </summary>
    public string OrdersPrefix => $"{RootFolder}/orders/";

    private bool AnyPhotoSettingGiven => CloudName.Length > 0 || ApiKey.Length > 0 || ApiSecret.Length > 0 || RootFolder.Length > 0;

    [GeneratedRegex("^[a-z0-9-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex NameShape();

    /// <summary>
    /// Refuses a folder that could reach the wrong photos (D-07, T-09-07). Production must use <c>csps</c>; every other
    /// environment must not. A host with no photo settings at all passes, so it still starts and answers 503 on upload.
    /// Failures never repeat a key, a secret or a value.
    /// </summary>
    internal sealed class Validator : IValidateOptions<CloudinarySettings>
    {
        private const string ShapeMessage = "may use lowercase letters, digits and hyphens only.";
        private readonly bool _isProduction;

        public Validator(string environmentName)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(environmentName);
            _isProduction = string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase);
        }

        public ValidateOptionsResult Validate(string? name, CloudinarySettings options)
        {
            if (!options.AnyPhotoSettingGiven)
            {
                return ValidateOptionsResult.Success;
            }

            List<string> failures = [];
            if (options.CloudName.Length > 0 && !NameShape().IsMatch(options.CloudName))
            {
                failures.Add($"Cloudinary:CloudName {ShapeMessage}");
            }

            AddFolderFailures(options.RootFolder, failures);
            return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
        }

        private void AddFolderFailures(string root, List<string> failures)
        {
            if (root.Length == 0)
            {
                failures.Add(_isProduction
                    ? $"Cloudinary:RootFolder must be {LiveRootFolder} in Production."
                    : $"Cloudinary:RootFolder must be set. Use {DevRootFolder} outside Production.");
            }
            else if (!NameShape().IsMatch(root))
            {
                failures.Add($"Cloudinary:RootFolder {ShapeMessage}");
            }
            else if (_isProduction && root != LiveRootFolder)
            {
                failures.Add($"Cloudinary:RootFolder must be {LiveRootFolder} in Production.");
            }
            else if (!_isProduction && root == LiveRootFolder)
            {
                failures.Add($"Cloudinary:RootFolder {LiveRootFolder} is the live folder. Use {DevRootFolder} outside Production.");
            }
        }
    }
}
