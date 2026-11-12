namespace Csps.Domain.Content;

/// <summary>The URL key of a product line (UI-SPEC line keys, CWE-601).</summary>
public static class LineKey
{
    /// <summary>Makes the key for a new line from its short name.</summary>
    /// <param name="shortName">The short name.</param>
    /// <param name="taken">The keys that exist already.</param>
    /// <returns>The key.</returns>
    public static string From(string shortName, IReadOnlySet<string> taken) => throw new NotImplementedException();

    /// <summary>Tells whether a text is a well-formed key.</summary>
    /// <param name="key">The text.</param>
    /// <returns>True for a key.</returns>
    public static bool IsValid(string? key) => throw new NotImplementedException();
}
