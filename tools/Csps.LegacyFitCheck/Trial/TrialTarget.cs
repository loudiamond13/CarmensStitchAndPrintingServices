using System.Globalization;
using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>The verdict on a trial server template.</summary>
/// <param name="Allowed">True when the trial database may be created on this server.</param>
/// <param name="Reason">A fixed sentence. It never repeats the connection string.</param>
internal sealed record TrialTargetCheck(bool Allowed, string Reason);

/// <summary>
/// Decides where the throwaway trial database may live and what it may be called (D-07, T-07.1-19). Pure: it never opens a connection.
/// The server follows <c>DevSeedTargetGuard</c>: only <c>(localdb)\MSSQLLocalDB</c> or a loopback container address. The name must be
/// a generated <c>CSPS_Test_{guid}</c> name and must differ from the source database.
/// </summary>
internal static class TrialTarget
{
    private const string LocalDbInstance = @"(localdb)\MSSQLLocalDB";

    private const string ServerRefusal =
        @"The trial database must be on the (localdb)\MSSQLLocalDB instance, or on a SQL Server container on this machine "
        + "addressed as 127.0.0.1,<port> or localhost,<port>. Every other server is refused.";

    private static readonly string[] ContainerHosts = ["127.0.0.1", "localhost"];

    public static TrialTargetCheck Check(string? serverTemplate)
    {
        if (string.IsNullOrWhiteSpace(serverTemplate))
        {
            return Refused("No trial server was given.");
        }

        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(serverTemplate);
        }
        catch (Exception error) when (error is ArgumentException or FormatException or KeyNotFoundException or InvalidOperationException)
        {
            return Refused("The trial server connection string could not be read.");
        }

        if (!string.IsNullOrEmpty(builder.AttachDBFilename))
        {
            return Refused("AttachDBFilename is not allowed for the trial server.");
        }

        if (!string.IsNullOrEmpty(builder.FailoverPartner))
        {
            return Refused("Failover Partner is not allowed for the trial server: it names a second server.");
        }

        return IsAllowedServer(builder.DataSource)
            ? new TrialTargetCheck(true, "An allowed trial server.")
            : Refused(ServerRefusal);
    }

    /// <summary>Builds the trial connection string, or throws when the server, the name or the source clash with the rules.</summary>
    /// <param name="serverTemplate">The server template.</param>
    /// <param name="name">The generated trial database name.</param>
    /// <param name="sourceDatabaseName">The name of the legacy source database, which the trial must never equal.</param>
    /// <returns>The connection string of the trial database.</returns>
    public static string For(string serverTemplate, string name, string sourceDatabaseName)
    {
        ArgumentNullException.ThrowIfNull(serverTemplate);
        ArgumentNullException.ThrowIfNull(name);
        ArgumentNullException.ThrowIfNull(sourceDatabaseName);

        var verdict = Check(serverTemplate);
        if (!verdict.Allowed)
        {
            throw new InvalidOperationException(verdict.Reason);
        }

        if (!TrialDatabaseName.IsDisposable(name))
        {
            throw new InvalidOperationException("The trial database name is not a CSPS_Test_{guid} name.");
        }

        if (string.Equals(name, sourceDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The trial database name equals the source database name.");
        }

        return new SqlConnectionStringBuilder(serverTemplate) { InitialCatalog = name }.ConnectionString;
    }

    private static bool IsAllowedServer(string dataSource)
    {
        var server = dataSource.Trim();
        if (string.Equals(server, LocalDbInstance, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var parts = server.Split(',');
        return parts.Length == 2
            && ContainerHosts.Contains(parts[0], StringComparer.OrdinalIgnoreCase)
            && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var port)
            && port is >= 1 and <= 65535;
    }

    private static TrialTargetCheck Refused(string reason) => new(false, reason);
}
