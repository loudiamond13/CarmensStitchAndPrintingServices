using System.Diagnostics.CodeAnalysis;

namespace Csps.Domain.Content;

/// <summary>
/// The allow-list rules for the links and the text the public site shows (CONT-01, D-24, CWE-601). A link must be https on an exact
/// allow-listed host with no sign-in part and no odd port, so a typed value can never send a visitor to another site or run a script.
/// The rules check the text exactly as given; callers trim first. No rule uses a regular expression (CWE-1333).
/// </summary>
public static class SiteLinks
{
    /// <summary>The message for a Messenger link that breaks the rule.</summary>
    public const string MessengerInvalidMessage = "Paste your Messenger link, like https://m.me/yourpage.";

    /// <summary>The message for a Facebook link that breaks the rule.</summary>
    public const string FacebookInvalidMessage = "Paste your Facebook page link, like https://www.facebook.com/yourpage.";

    /// <summary>The message for an Instagram link that breaks the rule.</summary>
    public const string InstagramInvalidMessage = "Paste your Instagram link, like https://www.instagram.com/yourpage.";

    /// <summary>The message for a TikTok link that breaks the rule.</summary>
    public const string TikTokInvalidMessage = "Paste your TikTok link, like https://www.tiktok.com/@yourpage.";

    /// <summary>The message for a directions link that breaks the rule.</summary>
    public const string DirectionsInvalidMessage = "Paste a Google Maps link, like https://maps.app.goo.gl/abc123.";

    /// <summary>The message for a map embed link that breaks the rule.</summary>
    public const string MapEmbedInvalidMessage = "Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.";

    /// <summary>
    /// The message for text that still holds a square-bracket placeholder. It is not in the UI-SPEC, so the owner approves the wording
    /// (SPEC-GAP, plan 11-09).
    /// </summary>
    public const string PlaceholderTextMessage = "Replace the text in square brackets with the real words.";

    private const string HttpsPrefix = "https://";
    private const string MessengerPrefix = "https://m.me/";
    private const string MapEmbedPrefix = "https://www.google.com/maps/embed?";
    private const int MessengerNameMaxLength = 100;
    private const string MapsPath = "/maps";

    private static readonly string[] FacebookHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"];
    private static readonly string[] InstagramHosts = ["instagram.com", "www.instagram.com"];
    private static readonly string[] TikTokHosts = ["tiktok.com", "www.tiktok.com"];

    /// <summary>Tells whether the text is <c>https://m.me/</c> plus 1 to 100 letters, digits or dots.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsMessengerLink(string? value)
    {
        if (value is null || !value.StartsWith(MessengerPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        var name = value.AsSpan(MessengerPrefix.Length);
        if (name.Length is 0 or > MessengerNameMaxLength)
        {
            return false;
        }

        foreach (var character in name)
        {
            if (!char.IsAsciiLetterOrDigit(character) && character != '.')
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Tells whether the text is an https link on facebook.com, www.facebook.com, m.facebook.com or fb.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsFacebookLink(string? value) => TryParseHttps(value, out var uri) && FacebookHosts.Contains(uri.Host, StringComparer.Ordinal);

    /// <summary>Tells whether the text is an https link on instagram.com or www.instagram.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsInstagramLink(string? value) => TryParseHttps(value, out var uri) && InstagramHosts.Contains(uri.Host, StringComparer.Ordinal);

    /// <summary>Tells whether the text is an https link on tiktok.com or www.tiktok.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsTikTokLink(string? value) => TryParseHttps(value, out var uri) && TikTokHosts.Contains(uri.Host, StringComparer.Ordinal);

    /// <summary>Tells whether the text is a Google Maps link: https on maps.app.goo.gl, goo.gl/maps, www.google.com/maps or maps.google.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsDirectionsLink(string? value)
    {
        if (!TryParseHttps(value, out var uri))
        {
            return false;
        }

        return uri.Host switch
        {
            "maps.app.goo.gl" or "maps.google.com" => true,
            "goo.gl" or "www.google.com" => IsUnderMaps(uri.AbsolutePath),
            _ => false,
        };
    }

    /// <summary>Tells whether the text is a link that starts with <c>https://www.google.com/maps/embed?</c>.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsMapEmbedLink(string? value) =>
        value is not null && value.StartsWith(MapEmbedPrefix, StringComparison.Ordinal) && IsPlainLinkText(value);

    /// <summary>Tells whether the text holds a square-bracket placeholder such as <c>[Shop address]</c>.</summary>
    /// <param name="value">The text.</param>
    /// <returns>True when a <c>[</c> is followed later by a <c>]</c>.</returns>
    public static bool HasBracketPlaceholder(string? value)
    {
        if (value is null)
        {
            return false;
        }

        var open = value.IndexOf('[', StringComparison.Ordinal);
        return open >= 0 && value.IndexOf(']', open + 1) >= 0;
    }

    // https only, plain characters, the standard port and no sign-in part; the caller then checks the host.
    private static bool TryParseHttps(string? value, [NotNullWhen(true)] out Uri? uri)
    {
        uri = null;
        if (value is null || !value.StartsWith(HttpsPrefix, StringComparison.Ordinal) || !IsPlainLinkText(value))
        {
            return false;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var parsed)
            || !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.Ordinal)
            || !parsed.IsDefaultPort
            || parsed.UserInfo.Length != 0)
        {
            return false;
        }

        uri = parsed;
        return true;
    }

    private static bool IsUnderMaps(string path) =>
        string.Equals(path, MapsPath, StringComparison.Ordinal) || path.StartsWith(MapsPath + "/", StringComparison.Ordinal);

    // Visible ASCII only, so no space, control or look-alike character, and none that can close an attribute or open a tag.
    private static bool IsPlainLinkText(string value)
    {
        foreach (var character in value)
        {
            if (character is <= ' ' or > '~' or '"' or '\'' or '<' or '>' or '\\' or '`' or '[' or ']')
            {
                return false;
            }
        }

        return true;
    }
}
