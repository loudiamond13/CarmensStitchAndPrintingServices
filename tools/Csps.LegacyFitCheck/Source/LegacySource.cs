using System.Globalization;
using Csps.LegacyFitCheck.Trial;
using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck.Source;

/// <summary>The verdict on a source connection string.</summary>
/// <param name="Allowed">True when the tool may read this source.</param>
/// <param name="Reason">A fixed sentence. It never repeats the connection string.</param>
internal sealed record LegacySourceCheck(bool Allowed, string Reason);

/// <summary>
/// The one legacy restore the tool may read, and the guard that refuses everything else (D-07). Pure: it never opens a connection.
/// Server first (the default LocalDB instance, or a loopback container in tests), then the database: the restore on LocalDB, or a
/// disposable <c>CSPS_Test_{guid}</c> fake. Modelled on <c>DevSeedTargetGuard</c>.
/// </summary>
internal static class LegacySource
{
    public const string DatabaseName = "CSPS_Legacy_Restore";
    public const string LocalDbInstance = @"(localdb)\MSSQLLocalDB";
    public const string ApplicationName = "Csps.LegacyFitCheck";

    private const string ServerRefusal =
        @"The legacy source must be the (localdb)\MSSQLLocalDB instance, or a SQL Server container on this machine "
        + "addressed as 127.0.0.1,<port> or localhost,<port> (tests only).";

    private static readonly string[] ContainerHosts = ["127.0.0.1", "localhost"];

    /// <summary>The fixed source: the restore on the default LocalDB instance. Built from constants only.</summary>
    public static string ConnectionString { get; } = new SqlConnectionStringBuilder
    {
        DataSource = LocalDbInstance,
        InitialCatalog = DatabaseName,
        IntegratedSecurity = true,
        Pooling = false,
        ApplicationName = ApplicationName,
    }.ConnectionString;

    public static LegacySourceCheck Check(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Refused("No connection string was given.");
        }

        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString);
        }
        catch (Exception error) when (error is ArgumentException or FormatException or KeyNotFoundException or InvalidOperationException)
        {
            return Refused("The connection string could not be read.");
        }

        if (!string.IsNullOrEmpty(builder.AttachDBFilename))
        {
            return Refused("AttachDBFilename is not allowed. Name the database with Initial Catalog instead.");
        }

        if (!string.IsNullOrEmpty(builder.FailoverPartner))
        {
            return Refused("Failover Partner is not allowed: it names a second server. Remove it.");
        }

        var onLocalDb = string.Equals(builder.DataSource.Trim(), LocalDbInstance, StringComparison.OrdinalIgnoreCase);
        if (!onLocalDb && !IsContainerAddress(builder.DataSource))
        {
            return Refused(ServerRefusal);
        }

        var database = builder.InitialCatalog;
        if (string.IsNullOrWhiteSpace(database))
        {
            return Refused("The connection string names no database (Initial Catalog or Database).");
        }

        if (onLocalDb && string.Equals(database, DatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            return new LegacySourceCheck(true, "The legacy restore.");
        }

        if (TrialDatabaseName.IsDisposable(database))
        {
            return new LegacySourceCheck(true, "A disposable test database.");
        }

        return Refused("The legacy source must be the restore on LocalDB or a disposable CSPS_Test database. Every other database is refused.");
    }

    /// <summary>Forces no pooling and the tool's application name on an allowed connection string.</summary>
    public static string Prepare(string connectionString)
    {
        ArgumentNullException.ThrowIfNull(connectionString);
        return new SqlConnectionStringBuilder(connectionString)
        {
            Pooling = false,
            ApplicationName = ApplicationName,
        }.ConnectionString;
    }

    private static bool IsContainerAddress(string dataSource)
    {
        var parts = dataSource.Trim().Split(',');
        return parts.Length == 2
            && ContainerHosts.Contains(parts[0], StringComparer.OrdinalIgnoreCase)
            && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var port)
            && port is >= 1 and <= 65535;
    }

    private static LegacySourceCheck Refused(string reason) => new(false, reason);
}
