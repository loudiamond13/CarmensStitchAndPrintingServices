using Csps.Infrastructure.Maintenance;

namespace Csps.HostProbe;

/// <summary>Asks the SQL server for its default backup folder (the job's own read-only question, D-49).</summary>
internal delegate Task<DefaultBackupFolderOutcome> DefaultBackupFolderReader(
    string connectionString,
    TimeSpan timeout,
    CancellationToken cancellationToken);

/// <summary>
/// What the folder question reports. Unlike the backup facts this holds a path, the server's own default backup folder, so the
/// owner keeps this answer out of chat. It never holds a connection string or an exception message.
/// </summary>
internal sealed record BackupFolderFacts(
    string? DefaultBackupFolder,
    IReadOnlyList<string> MissingSettings,
    IReadOnlyList<int> SqlErrorNumbers,
    string? ErrorType);

/// <summary>The one-time question that shows where the SQL server itself puts backups (D-49).</summary>
internal static class BackupFolderCheck
{
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(30);

    /// <summary>Asks once with the site's own login. Only the connection string setting is needed.</summary>
    /// <param name="settings">The backup settings.</param>
    /// <param name="reader">The folder reader (a fake in tests).</param>
    /// <param name="cancellationToken">Cancels the question.</param>
    /// <returns>The facts.</returns>
    public static async Task<BackupFolderFacts> RunAsync(
        BackupSettings settings,
        DefaultBackupFolderReader reader,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(reader);

        if (string.IsNullOrWhiteSpace(settings.ConnectionString))
        {
            return new BackupFolderFacts(null, [BackupSettings.ConnectionStringKey], [], null);
        }

        try
        {
            var outcome = await reader(settings.ConnectionString, Budget, cancellationToken).ConfigureAwait(false);
            return new BackupFolderFacts(outcome.Folder, [], outcome.SqlErrorNumbers, null);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return new BackupFolderFacts(null, [], [], error.GetType().Name);
        }
    }
}
