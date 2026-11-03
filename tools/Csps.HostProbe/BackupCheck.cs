using System.Globalization;
using Csps.Infrastructure.Maintenance;

namespace Csps.HostProbe;

/// <summary>Runs the job's own backup statement (the same code the monthly job runs, D-42).</summary>
internal delegate Task<BackupStatementOutcome> BackupRunner(
    string connectionString,
    string sqlServerFolder,
    string fileName,
    TimeSpan timeout,
    TimeProvider time,
    CancellationToken cancellationToken);

/// <summary>
/// The three settings of the backup check. They are read from the owner's one PowerShell window and never printed.
/// The app folder is optional: when set, the probe also looks for the file from the app's side.
/// </summary>
internal sealed record BackupSettings(string? ConnectionString, string? SqlServerFolder, string? AppFolder)
{
    public const string ConnectionStringKey = "HostProbe:Backup:ConnectionString";
    public const string SqlServerFolderKey = "HostProbe:Backup:SqlServerFolder";
    public const string AppFolderKey = "HostProbe:Backup:AppFolder";

    public static BackupSettings From(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        return new BackupSettings(configuration[ConnectionStringKey], configuration[SqlServerFolderKey], configuration[AppFolderKey]);
    }
}

/// <summary>
/// What the backup check reports (D-42, D-36). Booleans, numbers, seconds and an error type name only: never a path, a database
/// name, a server name, a connection string or an exception message.
/// </summary>
internal sealed record BackupFacts(
    bool Written,
    string? FileName,
    IReadOnlyList<string> MissingSettings,
    string? Refused,
    bool TimedOut,
    IReadOnlyList<int> SqlErrorNumbers,
    double Seconds,
    bool AppFolderChecked,
    bool? AppFolderInsideContentRoot,
    bool AppSawFile,
    double? SizeMb,
    bool AppRenamed,
    bool AppDeleted,
    bool AppFileGone,
    string? ErrorType,
    DateTimeOffset CheckedAtUtc);

/// <summary>The one-time check that the site's own login can write a database backup into the db folder (D-42, D-45).</summary>
internal static class BackupCheck
{
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(120);
    private const double BytesPerMegabyte = 1024d * 1024d;
    private const string PartSuffix = ".part";

    /// <summary>Runs the statement once, then looks for the file from the app's side when an app folder is set.</summary>
    /// <param name="settings">The three settings.</param>
    /// <param name="contentRoot">The probe's content root, to tell whether the app folder sits inside it.</param>
    /// <param name="runner">The statement runner (a fake in tests).</param>
    /// <param name="time">The clock for the file name and the seconds.</param>
    /// <param name="cancellationToken">Cancels the check.</param>
    /// <returns>The facts.</returns>
    public static async Task<BackupFacts> RunAsync(
        BackupSettings settings,
        string contentRoot,
        BackupRunner runner,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(runner);
        ArgumentNullException.ThrowIfNull(time);

        var now = time.GetUtcNow();
        var missing = MissingSettings(settings);
        var insideRoot = string.IsNullOrWhiteSpace(settings.AppFolder) ? (bool?)null : IsInside(settings.AppFolder, contentRoot);
        if (missing.Count > 0)
        {
            return Facts(now, written: false, fileName: null, missing, appFolderInsideContentRoot: insideRoot);
        }

        var fileName = "csps-probe-" + now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + ".bak" + PartSuffix;
        var started = time.GetTimestamp();
        BackupStatementOutcome outcome;
        try
        {
            outcome = await runner(settings.ConnectionString!, settings.SqlServerFolder!, fileName, Budget, time, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return Facts(now, written: false, fileName, [], appFolderInsideContentRoot: insideRoot, seconds: time.GetElapsedTime(started).TotalSeconds, errorType: error.GetType().Name);
        }

        var facts = Facts(
            now,
            outcome.Written,
            fileName,
            [],
            outcome.Refused,
            outcome.TimedOut,
            outcome.SqlErrorNumbers,
            outcome.Elapsed.TotalSeconds,
            insideRoot);

        return outcome.Written && !string.IsNullOrWhiteSpace(settings.AppFolder)
            ? CheckFromTheAppSide(facts, settings.AppFolder, fileName)
            : facts;
    }

    // The app's own view of the db folder: is the file there, how big, can the app rename it, delete it and see it gone (D-45).
    private static BackupFacts CheckFromTheAppSide(BackupFacts facts, string appFolder, string fileName)
    {
        var part = Path.Combine(appFolder, fileName);
        var final = part[..^PartSuffix.Length];
        var withFolder = facts with { AppFolderChecked = true };
        try
        {
            if (!File.Exists(part))
            {
                return withFolder;
            }

            var seen = withFolder with { AppSawFile = true, SizeMb = Math.Round(new FileInfo(part).Length / BytesPerMegabyte, 2) };
            File.Move(part, final);
            seen = seen with { AppRenamed = true };
            File.Delete(final);
            return seen with { AppDeleted = true, AppFileGone = !File.Exists(final) && !File.Exists(part) };
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return withFolder with
            {
                AppSawFile = File.Exists(part) || File.Exists(final),
                ErrorType = error.GetType().Name,
            };
        }
    }

    private static List<string> MissingSettings(BackupSettings settings)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(settings.ConnectionString))
        {
            missing.Add(BackupSettings.ConnectionStringKey);
        }

        if (string.IsNullOrWhiteSpace(settings.SqlServerFolder))
        {
            missing.Add(BackupSettings.SqlServerFolderKey);
        }

        return missing;
    }

    private static bool IsInside(string folder, string root)
    {
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        var fullRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar;
        var fullFolder = Path.TrimEndingDirectorySeparator(Path.GetFullPath(folder)) + Path.DirectorySeparatorChar;
        return fullFolder.StartsWith(fullRoot, comparison);
    }

    private static BackupFacts Facts(
        DateTimeOffset now,
        bool written,
        string? fileName,
        IReadOnlyList<string> missing,
        string? refused = null,
        bool timedOut = false,
        IReadOnlyList<int>? sqlErrorNumbers = null,
        double seconds = 0,
        bool? appFolderInsideContentRoot = null,
        string? errorType = null) =>
        new(
            Written: written,
            FileName: fileName,
            MissingSettings: missing,
            Refused: refused,
            TimedOut: timedOut,
            SqlErrorNumbers: sqlErrorNumbers ?? [],
            Seconds: Math.Round(seconds, 1),
            AppFolderChecked: false,
            AppFolderInsideContentRoot: appFolderInsideContentRoot,
            AppSawFile: false,
            SizeMb: null,
            AppRenamed: false,
            AppDeleted: false,
            AppFileGone: false,
            ErrorType: errorType,
            CheckedAtUtc: now);
}
