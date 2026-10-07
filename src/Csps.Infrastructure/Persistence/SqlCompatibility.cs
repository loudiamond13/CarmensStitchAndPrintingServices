namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The SQL Server database compatibility level EF Core generates SQL for (D-13). This is the only place
/// the number appears: re-pin it here once the hosting record (FND-13) reports the host's verified level.
/// </summary>
public static class SqlCompatibility
{
    /// <summary>Provisional compatibility level (SQL Server 2022 behaviour). No JSON columns exist, so this is safe.</summary>
    public const int Level = 160;
}
