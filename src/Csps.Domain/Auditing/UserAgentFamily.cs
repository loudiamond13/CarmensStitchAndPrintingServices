namespace Csps.Domain.Auditing;

/// <summary>Reduces a User-Agent header to a family label (D-24).</summary>
public static class UserAgentFamily
{
    /// <summary>The header was missing or blank.</summary>
    public const string Unknown = "Unknown";

    /// <summary>Returns the family label for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>A family label.</returns>
    public static string Classify(string? userAgent) => Unknown;
}
