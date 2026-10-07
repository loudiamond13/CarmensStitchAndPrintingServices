using Serilog;

namespace Csps.Server.Logging;

/// <summary>
/// Settings for the production log file sink (D-21): compact JSON files in <c>{contentRoot}/logs</c>, outside
/// <c>wwwroot</c>, one file per day plus a new file every 10 MB, at most 30 files and nothing older than 30 days.
/// <see cref="Shared"/> lets two IIS worker processes append to the same file during an overlapped recycle.
/// </summary>
/// <param name="Path">The absolute file path pattern; Serilog inserts the date before the extension.</param>
/// <param name="RollingInterval">How often a new file starts.</param>
/// <param name="RetainedFileCountLimit">The most files kept, including the current one.</param>
/// <param name="RetainedFileTimeLimit">The oldest file age kept.</param>
/// <param name="FileSizeLimitBytes">The largest size of one file.</param>
/// <param name="RollOnFileSizeLimit">Whether a full file rolls over to a new one instead of dropping events.</param>
/// <param name="Shared">Whether several processes may write the same file.</param>
/// <param name="FlushToDiskInterval">How often buffered events are flushed to disk.</param>
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
    /// <summary>The name of the log folder under the content root.</summary>
    public const string DirectoryName = "logs";

    /// <summary>
    /// Builds the D-21 settings for a content root. The path is always absolute: a relative Serilog path would
    /// resolve against the working directory, which on IIS is not the site folder (research A8).
    /// </summary>
    /// <param name="contentRootPath">The absolute content root of the application.</param>
    /// <returns>The settings.</returns>
    /// <exception cref="ArgumentException">The content root is blank or not an absolute path.</exception>
    public static LogFileSettings For(string contentRootPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(contentRootPath);
        if (!System.IO.Path.IsPathFullyQualified(contentRootPath))
        {
            throw new ArgumentException("The content root must be an absolute path.", nameof(contentRootPath));
        }

        return new LogFileSettings(
            Path: System.IO.Path.Combine(contentRootPath, DirectoryName, "csps-.json"),
            RollingInterval: RollingInterval.Day,
            RetainedFileCountLimit: 30,
            RetainedFileTimeLimit: TimeSpan.FromDays(30),
            FileSizeLimitBytes: 10 * 1024 * 1024,
            RollOnFileSizeLimit: true,
            Shared: true,
            FlushToDiskInterval: TimeSpan.FromSeconds(2));
    }
}
