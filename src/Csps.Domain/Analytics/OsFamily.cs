namespace Csps.Domain.Analytics;

/// <summary>Reduces a User-Agent to an operating system family label.</summary>
public static class OsFamily
{
    /// <summary>The longest label.</summary>
    public const int MaxLength = 20;

    /// <summary>Returns the OS family for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>A fixed label.</returns>
    public static string From(string? userAgent) => string.Empty;
}
