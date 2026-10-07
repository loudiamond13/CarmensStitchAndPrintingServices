namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Decides whether the dev seed may touch the database a connection string names (D-08, CLAUDE.md). Pure: it
/// never opens a connection.
/// </summary>
public static class DevSeedTargetGuard
{
    /// <summary>The development database.</summary>
    public const string DevDatabase = "CSPS_Dev";

    /// <summary>The end-to-end test database.</summary>
    public const string E2EDatabase = "CSPS_E2E";

    /// <summary>Checks a connection string.</summary>
    /// <param name="connectionString">The connection string the command would use.</param>
    /// <returns>The verdict.</returns>
    public static DevSeedTargetCheck Check(string? connectionString)
    {
        _ = connectionString;
        return new DevSeedTargetCheck(false, null, string.Empty);
    }
}
