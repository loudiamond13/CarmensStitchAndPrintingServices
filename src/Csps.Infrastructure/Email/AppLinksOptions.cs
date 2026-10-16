using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Where the links in emails point (IN-06). Every link is built from <see cref="PublicBaseUrl"/>, never from the
/// request host, so a forged Host header cannot poison a reset link. Tokens go in the URL fragment only.
/// </summary>
public sealed class AppLinksOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "App";

    /// <summary>The failure message for a missing or malformed base URL. It never contains the value.</summary>
    public const string PublicBaseUrlInvalidMessage =
        "App:PublicBaseUrl must be an absolute https URL with no query or fragment (http is allowed only for localhost). "
        + "In Development it is set in appsettings.Development.json; in Production set it in the host settings.";

    /// <summary>Gets or sets the site's public address, for example <c>https://example.com</c>.</summary>
    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>Returns the forgot-password page link, which carries no token.</summary>
    /// <returns>The absolute URL.</returns>
    public string ForgotPasswordPage() => Build("/admin/forgot-password", token: null);

    /// <summary>Returns the reset page link with the token in the fragment.</summary>
    /// <param name="token">The reset token.</param>
    /// <returns>The absolute URL.</returns>
    public string ResetPasswordLink(string token) => Build("/admin/reset-password", token);

    /// <summary>Returns the accept-invite page link with the token in the fragment.</summary>
    /// <param name="token">The invite token.</param>
    /// <returns>The absolute URL.</returns>
    public string AcceptInviteLink(string token) => Build("/admin/accept-invite", token);

    /// <summary>Tells whether <paramref name="options"/> holds a usable base URL.</summary>
    /// <param name="options">The options to check.</param>
    /// <returns>True when the base URL is acceptable.</returns>
    internal static bool IsValid(AppLinksOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (!Uri.TryCreate(options.PublicBaseUrl, UriKind.Absolute, out var url) || !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
        {
            return false;
        }

        return url.Scheme == Uri.UriSchemeHttps || (url.Scheme == Uri.UriSchemeHttp && (url.IsLoopback || url.Host == "localhost"));
    }

    private string Build(string path, string? token)
    {
        var link = PublicBaseUrl.TrimEnd('/') + path;
        return token is null ? link : link + "#token=" + Uri.EscapeDataString(token);
    }

    internal sealed class Validator : IValidateOptions<AppLinksOptions>
    {
        public ValidateOptionsResult Validate(string? name, AppLinksOptions options) =>
            IsValid(options) ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(PublicBaseUrlInvalidMessage);
    }
}
