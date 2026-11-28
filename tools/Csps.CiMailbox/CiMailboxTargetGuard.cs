using System.Globalization;
using Microsoft.Data.SqlClient;

namespace Csps.CiMailbox;

/// <summary>The verdict of <see cref="CiMailboxTargetGuard.Check"/>.</summary>
/// <param name="Allowed">True when the tool may connect.</param>
/// <param name="DatabaseName">The database the string names, or null.</param>
/// <param name="Reason">A plain reason that never repeats the connection string.</param>
public sealed record CiMailboxTargetCheck(bool Allowed, string? DatabaseName, string Reason);

/// <summary>
/// Decides whether the CI mailbox tool may open a connection (14 D-36, T-14-08). CI only; never run against a real database.
/// Pure: it never opens a connection. It allows one target: a loopback container (<c>127.0.0.1,&lt;port&gt;</c> or
/// <c>localhost,&lt;port&gt;</c>) database named <see cref="DatabaseName"/>, and only when <c>GITHUB_ACTIONS</c> is exactly <c>true</c>.
/// The loopback host and the database name are the real gate. <c>GITHUB_ACTIONS</c> only guards against a mistake: anyone can
/// set it on their own PC, and a port forwarded to loopback that reaches a database named <c>CSPS_Zap</c> would pass.
/// </summary>
public static class CiMailboxTargetGuard
{
    /// <summary>The only database the tool may read.</summary>
    public const string DatabaseName = "CSPS_Zap";

    private static readonly string[] ContainerHosts = ["127.0.0.1", "localhost"];

    /// <summary>Checks a connection string and the environment. Reasons never repeat the connection string, which holds a password.</summary>
    /// <param name="connectionString">The connection string the tool would use.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <returns>The verdict.</returns>
    public static CiMailboxTargetCheck Check(string? connectionString, Func<string, string?> getEnvironmentVariable)
    {
        ArgumentNullException.ThrowIfNull(getEnvironmentVariable);

        if (!string.Equals(getEnvironmentVariable("GITHUB_ACTIONS"), "true", StringComparison.Ordinal))
        {
            return Refused(null, "The CI mailbox tool runs only inside GitHub Actions (GITHUB_ACTIONS must be true).");
        }

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

        if (!string.IsNullOrEmpty(builder.AttachDBFilename) || !string.IsNullOrEmpty(builder.FailoverPartner))
        {
            return Refused(database, "AttachDBFilename and Failover Partner are not allowed. Name the database with Initial Catalog.");
        }

        if (!IsContainerServer(builder.DataSource))
        {
            return Refused(
                database,
                "The CI mailbox tool reads only a SQL Server container on this machine, addressed as 127.0.0.1,<port> or localhost,<port>. Every other server is refused.");
        }

        if (!string.Equals(database, DatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            return Refused(database, $"The CI mailbox tool reads only {DatabaseName}. The connection string names a different database, or none.");
        }

        return new CiMailboxTargetCheck(true, database, $"{database} in the CI container is an allowed target.");
    }

    private static bool IsContainerServer(string dataSource)
    {
        var parts = dataSource.Trim().Split(',');
        return parts.Length == 2
            && ContainerHosts.Contains(parts[0], StringComparer.OrdinalIgnoreCase)
            && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var port)
            && port is >= 1 and <= 65535;
    }

    private static CiMailboxTargetCheck Refused(string? database, string reason) => new(false, database, reason);
}
