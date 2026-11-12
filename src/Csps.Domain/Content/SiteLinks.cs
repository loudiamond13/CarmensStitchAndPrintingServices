namespace Csps.Domain.Content;

/// <summary>
/// The allow-list rules for the links and the text the public site shows (CONT-01, D-24, CWE-601). A link must be https on an exact
/// allow-listed host with no sign-in part and no odd port, so a typed value can never send a visitor to another site or run a script.
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

    /// <summary>Tells whether the text is <c>https://m.me/</c> plus 1 to 100 letters, digits or dots.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsMessengerLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text is an https link on facebook.com, www.facebook.com, m.facebook.com or fb.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsFacebookLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text is an https link on instagram.com or www.instagram.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsInstagramLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text is an https link on tiktok.com or www.tiktok.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsTikTokLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text is a Google Maps link: https on maps.app.goo.gl, goo.gl/maps, www.google.com/maps or maps.google.com.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsDirectionsLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text is a link that starts with <c>https://www.google.com/maps/embed?</c>.</summary>
    /// <param name="value">The link, exactly as typed.</param>
    /// <returns>True when the link is allowed.</returns>
    public static bool IsMapEmbedLink(string? value) => throw new NotImplementedException();

    /// <summary>Tells whether the text holds a square-bracket placeholder such as <c>[Shop address]</c>.</summary>
    /// <param name="value">The text.</param>
    /// <returns>True when a <c>[</c> is followed later by a <c>]</c>.</returns>
    public static bool HasBracketPlaceholder(string? value) => throw new NotImplementedException();
}
