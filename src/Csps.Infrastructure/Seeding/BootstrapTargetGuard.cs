using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Seeding;

/// <summary>The verdict of <see cref="BootstrapTargetGuard.Check"/>.</summary>
/// <param name="Allowed">True only when the command may use this database.</param>
/// <param name="DatabaseName">The database the connection string names, when it could be read.</param>
/// <param name="Reason">Plain-English explanation; never contains the connection string itself.</param>
public sealed record BootstrapTargetCheck(bool Allowed, string? DatabaseName, string Reason);

/// <summary>
/// Decides whether <c>bootstrap-manager</c> may write to the database a connection string names (AUTH-12, D-29, T-04-79).
/// Pure: it never opens a connection. The operator must repeat the database name in <c>--confirm-database</c>. The
/// other project's <c>BetsLLC_*</c> databases, <c>CSPS_Legacy_Restore</c> and the SQL Server system databases are always
/// refused, and on this machine only <c>CSPS_Dev</c>, <c>CSPS_E2E</c> and <c>CSPS_Test_&lt;guid&gt;</c> pass.
/// Reasons never repeat the connection string, which holds a password.
/// </summary>
public static partial class BootstrapTargetGuard
{
    private const string OtherProjectPrefix = "BetsLLC_";
    private const string LegacyRestore = "CSPS_Legacy_Restore";

    private static readonly string[] SystemDatabases = ["master", "model", "msdb", "tempdb"];

    private static readonly string[] LoopbackHosts = ["127.0.0.1", "localhost", "::1", ".", "(local)"];

    /// <summary>Checks a connection string against the database name the operator confirmed.</summary>
    /// <param name="connectionString">The connection string the command would use.</param>
    /// <param name="confirmedDatabase">The value of <c>--confirm-database</c>.</param>
    /// <returns>The verdict.</returns>
    public static BootstrapTargetCheck Check(string? connectionString, string? confirmedDatabase)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return Refused(null, "No connection string was given.");
        }

        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString);
        }
        catch (Exception error) when (error is ArgumentException or FormatException or KeyNotFoundException or InvalidOperationException)
        {
            return Refused(null, "The connection string could not be read.");
        }

        var database = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? null : builder.InitialCatalog.Trim();

        if (!string.IsNullOrEmpty(builder.AttachDBFilename))
        {
            return Refused(database, "AttachDBFilename is not allowed. Name the database with Initial Catalog instead.");
        }

        if (!string.IsNullOrEmpty(builder.FailoverPartner))
        {
            return Refused(database, "Failover Partner is not allowed: it names a second server the command could connect to. Remove it.");
        }

        if (database is null)
        {
            return Refused(null, "The connection string names no database (Initial Catalog or Database).");
        }

        var protectedReason = ProtectedReason(database);
        if (protectedReason is not null)
        {
            return Refused(database, protectedReason);
        }

        if (IsLocalServer(builder.DataSource) && !LocalDatabase().IsMatch(database))
        {
            return Refused(database, $"On this machine the command touches only CSPS_Dev, CSPS_E2E or CSPS_Test_<guid>, not '{database}'.");
        }

        if (string.IsNullOrWhiteSpace(confirmedDatabase))
        {
            return Refused(database, $"Pass --confirm-database {database} to confirm the database that will receive the first Manager.");
        }

        if (!string.Equals(confirmedDatabase.Trim(), database, StringComparison.OrdinalIgnoreCase))
        {
            return Refused(database, $"--confirm-database does not match the database in the connection string ('{database}'). Nothing was changed.");
        }

        return new BootstrapTargetCheck(true, database, $"{database} is confirmed.");
    }

    private static string? ProtectedReason(string database)
    {
        if (database.StartsWith(OtherProjectPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return $"'{database}' belongs to another project (BetsLLC_*). The command never touches it.";
        }

        if (string.Equals(database, LegacyRestore, StringComparison.OrdinalIgnoreCase))
        {
            return $"'{database}' is the restored copy of the old production database. The command never writes to it.";
        }

        return SystemDatabases.Contains(database, StringComparer.OrdinalIgnoreCase)
            ? $"'{database}' is a SQL Server system database."
            : null;
    }

    // A LocalDB instance or a loopback address, with an optional tcp: prefix, port or instance name.
    private static bool IsLocalServer(string dataSource)
    {
        var server = dataSource.Trim();
        if (server.StartsWith("(localdb)", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (server.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
        {
            server = server[4..];
        }

        var host = server.Split(',', '\\')[0];
        return LoopbackHosts.Contains(host, StringComparer.OrdinalIgnoreCase);
    }

    private static BootstrapTargetCheck Refused(string? database, string reason) => new(false, database, reason);

    [GeneratedRegex("^(CSPS_Dev|CSPS_E2E|CSPS_Test_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex LocalDatabase();
}
