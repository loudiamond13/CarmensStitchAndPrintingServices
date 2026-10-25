namespace Csps.Domain.Expenses;

/// <summary>The six colour tones an expense category can carry (D-13). The database accepts only these values.</summary>
public static class CategoryTones
{
    /// <summary>Grey.</summary>
    public const string Neutral = "neutral";

    /// <summary>The brand accent.</summary>
    public const string Accent = "accent";

    /// <summary>Informational blue.</summary>
    public const string Info = "info";

    /// <summary>The mockup purple.</summary>
    public const string Mockup = "mockup";

    /// <summary>Warning amber.</summary>
    public const string Warning = "warning";

    /// <summary>Success green.</summary>
    public const string Success = "success";

    /// <summary>Every tone, in the documented order.</summary>
    public static IReadOnlyList<string> All { get; } = [Neutral, Accent, Info, Mockup, Warning, Success];

    /// <summary>Tells whether a text is exactly one of the six tones (ordinal, case matters).</summary>
    /// <param name="tone">The text to check.</param>
    /// <returns>True for a known tone.</returns>
    public static bool IsValid(string? tone) => tone is not null && All.Contains(tone, StringComparer.Ordinal);
}
