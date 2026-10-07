namespace Csps.Server.Logging;

/// <summary>Compile-only stub (TDD RED).</summary>
public static class SensitiveDataMasking
{
    /// <summary>The replacement value.</summary>
    public const string Mask = "***";

    /// <summary>Stub.</summary>
    /// <param name="name">The property name.</param>
    /// <returns>Always false in the stub.</returns>
    public static bool IsSensitive(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return false;
    }
}
