using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// The result of one backup statement. It holds facts only: whether the file was written, which kind of value was refused,
/// whether the statement timed out, the SQL error numbers and the seconds taken. It never holds a path, a name or a message.
/// </summary>
/// <param name="Written">True when the statement finished.</param>
/// <param name="Refused">"database", "folder" or "file" when a value was refused before any connection opened; otherwise null.</param>
/// <param name="TimedOut">True when the command timeout was reached.</param>
/// <param name="SqlErrorNumbers">The SQL error numbers the server returned, without repeats.</param>
/// <param name="Elapsed">How long the statement took, measured with the given <see cref="TimeProvider"/>.</param>
internal sealed record BackupStatementOutcome(
    bool Written,
    string? Refused,
    bool TimedOut,
    IReadOnlyList<int> SqlErrorNumbers,
    TimeSpan Elapsed);

/// <summary>
/// The one raw SQL statement the site may run (D-40): a COPY_ONLY database backup for the monthly job and the host probe.
/// The database name (from the opened connection) and the full path (from settings) go in as parameters, never as SQL text,
/// and the connection never joins an ambient transaction because a backup cannot run inside one.
/// </summary>
internal static partial class SqlServerBackupStatement
{
    private const string Statement = "BACKUP DATABASE @database TO DISK = @path WITH COPY_ONLY, CHECKSUM, FORMAT, INIT";
    private const int MaxFolderLength = 200;
    private const int MaxDatabaseNameLength = 128;
    private const int TimeoutErrorNumber = -2;

    /// <summary>Runs the backup. A refused value, a SQL error or a timeout is reported in the outcome; any other failure is thrown.</summary>
    /// <param name="connectionString">The connection to back up. Its database is the one that is copied.</param>
    /// <param name="sqlServerFolder">The folder as the SQL server sees it.</param>
    /// <param name="fileName">The file name, lower-case letters, digits and hyphens plus .bak or .bak.part.</param>
    /// <param name="timeout">How long the server may take.</param>
    /// <param name="time">The clock used to measure the seconds.</param>
    /// <param name="cancellationToken">Cancels the statement.</param>
    /// <returns>The outcome.</returns>
    public static async Task<BackupStatementOutcome> RunAsync(
        string connectionString,
        string sqlServerFolder,
        string fileName,
        TimeSpan timeout,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        ArgumentNullException.ThrowIfNull(time);

        var started = time.GetTimestamp();
        var builder = new SqlConnectionStringBuilder(connectionString) { Enlist = false };

        if (!IsSafeFolder(sqlServerFolder))
        {
            return Refuse("folder", time, started);
        }

        if (!IsSafeFileName(fileName))
        {
            return Refuse("file", time, started);
        }

        if (!IsSafeDatabaseName(builder.InitialCatalog))
        {
            return Refuse("database", time, started);
        }

        var connection = new SqlConnection(builder.ConnectionString);
        await using (connection.ConfigureAwait(false))
        {
            try
            {
                await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
                if (!IsSafeDatabaseName(connection.Database))
                {
                    return Refuse("database", time, started);
                }

                var command = connection.CreateCommand();
                await using (command.ConfigureAwait(false))
                {
                    command.CommandText = Statement;
                    command.CommandTimeout = Math.Max(1, (int)Math.Ceiling(timeout.TotalSeconds));
                    command.Parameters.Add(new SqlParameter("@database", System.Data.SqlDbType.NVarChar, MaxDatabaseNameLength) { Value = connection.Database });
                    command.Parameters.Add(new SqlParameter("@path", System.Data.SqlDbType.NVarChar, MaxFolderLength + 100) { Value = Join(sqlServerFolder, fileName) });
                    await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
                }

                return new BackupStatementOutcome(true, null, false, [], time.GetElapsedTime(started));
            }
            catch (SqlException error)
            {
                var numbers = ErrorNumbers(error);
                return new BackupStatementOutcome(false, null, numbers.Contains(TimeoutErrorNumber), numbers, time.GetElapsedTime(started));
            }
        }
    }

    /// <summary>True for an absolute drive, UNC or POSIX path of plain characters, up to 200 long, with no dot-only segment.</summary>
    /// <param name="folder">The folder as the SQL server sees it.</param>
    /// <returns>True when the folder may reach the statement.</returns>
    public static bool IsSafeFolder(string? folder)
    {
        if (string.IsNullOrWhiteSpace(folder) || folder.Length > MaxFolderLength || !folder.All(IsFolderCharacter))
        {
            return false;
        }

        var absolute = folder.StartsWith('/')
            || folder.StartsWith(@"\\", StringComparison.Ordinal)
            || (folder.Length > 2 && char.IsAsciiLetter(folder[0]) && folder[1] == ':' && (folder[2] == '\\' || folder[2] == '/'));

        return absolute && !folder.Split('\\', '/').Any(segment => segment.Length > 0 && segment.All(character => character == '.'));
    }

    /// <summary>True for lower-case letters, digits and hyphens followed by .bak or .bak.part.</summary>
    /// <param name="fileName">The file name.</param>
    /// <returns>True when the name may reach the statement.</returns>
    public static bool IsSafeFileName(string? fileName) => fileName is not null && SafeFileName().IsMatch(fileName);

    /// <summary>True for 1 to 128 letters, digits, underscores and hyphens.</summary>
    /// <param name="databaseName">The database name.</param>
    /// <returns>True when the name may reach the statement.</returns>
    public static bool IsSafeDatabaseName(string? databaseName) =>
        !string.IsNullOrEmpty(databaseName)
        && databaseName.Length <= MaxDatabaseNameLength
        && databaseName.All(character => char.IsAsciiLetterOrDigit(character) || character == '_' || character == '-');

    private static bool IsFolderCharacter(char character) =>
        char.IsAsciiLetterOrDigit(character) || character is ' ' or '\\' or '/' or ':' or '.' or '_' or '-';

    // The SQL server's operating system may differ from the app's, so the folder's own separator is used (not Path.Combine).
    private static string Join(string folder, string fileName)
    {
        var separator = folder.Contains('\\', StringComparison.Ordinal) ? '\\' : '/';
        return folder.TrimEnd('\\', '/') + separator + fileName;
    }

    private static List<int> ErrorNumbers(SqlException error)
    {
        var numbers = new List<int>();
        foreach (SqlError item in error.Errors)
        {
            if (!numbers.Contains(item.Number))
            {
                numbers.Add(item.Number);
            }
        }

        if (!numbers.Contains(error.Number))
        {
            numbers.Add(error.Number);
        }

        return numbers;
    }

    private static BackupStatementOutcome Refuse(string kind, TimeProvider time, long started) =>
        new(false, kind, false, [], time.GetElapsedTime(started));

    [GeneratedRegex(@"^[a-z0-9-]+\.bak(\.part)?\z", RegexOptions.CultureInvariant)]
    private static partial Regex SafeFileName();
}
