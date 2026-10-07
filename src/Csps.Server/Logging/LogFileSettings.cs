using Serilog;

namespace Csps.Server.Logging;

/// <summary>Compile-only stub (TDD RED).</summary>
/// <param name="Path">The path.</param>
/// <param name="RollingInterval">The rolling interval.</param>
/// <param name="RetainedFileCountLimit">The file count limit.</param>
/// <param name="RetainedFileTimeLimit">The age limit.</param>
/// <param name="FileSizeLimitBytes">The size limit.</param>
/// <param name="RollOnFileSizeLimit">Whether to roll on size.</param>
/// <param name="Shared">Whether the file is shared.</param>
/// <param name="FlushToDiskInterval">The flush interval.</param>
public sealed record LogFileSettings(
    string Path,
    RollingInterval RollingInterval,
    int RetainedFileCountLimit,
    TimeSpan RetainedFileTimeLimit,
    long FileSizeLimitBytes,
    bool RollOnFileSizeLimit,
    bool Shared,
    TimeSpan FlushToDiskInterval)
{
    /// <summary>Stub.</summary>
    /// <param name="contentRootPath">The content root.</param>
    /// <returns>Placeholder settings.</returns>
    public static LogFileSettings For(string contentRootPath) =>
        new(contentRootPath, RollingInterval.Infinite, 0, TimeSpan.Zero, 0, false, false, TimeSpan.Zero);
}
