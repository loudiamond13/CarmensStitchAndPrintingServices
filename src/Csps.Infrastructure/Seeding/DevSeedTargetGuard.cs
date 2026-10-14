using System.Globalization;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Decides whether the dev seed may touch the database a connection string names (D-08, CLAUDE.md, T-01-13, WR-04).
/// Pure: it never opens a connection and never reads the environment. The server comes first: only the dedicated
/// <c>(localdb)\CSPS</c> instance, or a SQL Server container on this machine addressed as <c>127.0.0.1,&lt;port&gt;</c>
/// or <c>localhost,&lt;port&gt;</c>, is allowed. Every other server is refused, including the shared
/// <c>(localdb)\MSSQLLocalDB</c> instance, named-pipe and <c>tcp:</c> addresses, named instances and hosted servers.
/// The allow-list covers every server the connection could reach, so a <c>Failover Partner</c> is refused too. Then
/// only <see cref="DevDatabase"/> and <see cref="E2EDatabase"/> are allowed, compared case-insensitively because SQL
/// Server names are case-insensitive under the default collation. That keeps every other database out of reach:
/// another project's <c>BetsLLC_*</c> databases, the read-only <c>CSPS_Legacy_Restore</c> (D-06), test databases and
/// any hosted database.
/// </summary>
public static class DevSeedTargetGuard
{
    /// <summary>The development database.</summary>
    public const string DevDatabase = "CSPS_Dev";

    /// <summary>The end-to-end test database.</summary>
    public const string E2EDatabase = "CSPS_E2E";

    // CSPS's own LocalDB instance (D-05). TheBETSLLC uses the shared MSSQLLocalDB instance, which is refused.
    private const string DedicatedLocalDbInstance = @"(localdb)\CSPS";

    // Fixed text: it never repeats the data source, which could name a hosted server.
    private const string ServerRefusal =
        @"The dev seed runs only on the dedicated (localdb)\CSPS instance, or on a SQL Server container on this machine "
        + "addressed as 127.0.0.1,<port> or localhost,<port>. Every other server is refused, including the shared "
        + @"(localdb)\MSSQLLocalDB instance, named-pipe and tcp: addresses, named instances and hosted servers.";

    // The hosts a loopback SQL Server container is addressed by (Testcontainers, CSPS_TEST_SQL=container).
    private static readonly string[] ContainerHosts = ["127.0.0.1", "localhost"];

    /// <summary>Checks a connection string. Reasons never repeat the connection string, which may hold a password.</summary>
    /// <param name="connectionString">The connection string the command would use.</param>
    /// <returns>The verdict.</returns>
    public static DevSeedTargetCheck Check(string? connectionString)
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

        var database = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? null : builder.InitialCatalog;

        if (!string.IsNullOrEmpty(builder.AttachDBFilename))
        {
            return Refused(database, "AttachDBFilename is not allowed. Name the database with Initial Catalog instead.");
        }

        if (!string.IsNullOrEmpty(builder.FailoverPartner))
        {
            return Refused(database, "Failover Partner is not allowed: it names a second server the dev seed could connect to. Remove it.");
        }

        if (!IsAllowedServer(builder.DataSource))
        {
            return Refused(database, ServerRefusal);
        }

        if (database is null)
        {
            return Refused(null, "The connection string names no database (Initial Catalog or Database).");
        }

        if (!string.Equals(database, DevDatabase, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(database, E2EDatabase, StringComparison.OrdinalIgnoreCase))
        {
            return Refused(database, $"'{database}' is not {DevDatabase} or {E2EDatabase}. The dev seed never touches any other database.");
        }

        return new DevSeedTargetCheck(true, database, $"{database} is an allowed dev-seed target.");
    }

    private static bool IsAllowedServer(string dataSource)
    {
        var server = dataSource.Trim();
        if (string.Equals(server, DedicatedLocalDbInstance, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var parts = server.Split(',');
        return parts.Length == 2
            && ContainerHosts.Contains(parts[0], StringComparer.OrdinalIgnoreCase)
            && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var port)
            && port is >= 1 and <= 65535;
    }

    private static DevSeedTargetCheck Refused(string? database, string reason) => new(false, database, reason);
}
