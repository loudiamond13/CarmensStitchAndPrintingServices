using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Decides whether the dev seed may touch the database a connection string names (D-08, CLAUDE.md, T-01-13).
/// Pure: it never opens a connection. Only <see cref="DevDatabase"/> and <see cref="E2EDatabase"/> are allowed,
/// compared case-insensitively because SQL Server names are case-insensitive under the default collation. That
/// keeps every other database out of reach: another project's <c>BetsLLC_*</c> databases, the read-only
/// <c>CSPS_Legacy_Restore</c> (D-06), test databases and any hosted database.
/// </summary>
public static class DevSeedTargetGuard
{
    /// <summary>The development database.</summary>
    public const string DevDatabase = "CSPS_Dev";

    /// <summary>The end-to-end test database.</summary>
    public const string E2EDatabase = "CSPS_E2E";

    // TheBETSLLC's shared LocalDB instance. CSPS uses its own (localdb)\CSPS instance (D-05).
    private const string SharedLocalDbInstance = "MSSQLLocalDB";

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

        if (builder.DataSource.Contains(SharedLocalDbInstance, StringComparison.OrdinalIgnoreCase))
        {
            return Refused(database, @"The shared (localdb)\MSSQLLocalDB instance belongs to another project. Use (localdb)\CSPS.");
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

    private static DevSeedTargetCheck Refused(string? database, string reason) => new(false, database, reason);
}
