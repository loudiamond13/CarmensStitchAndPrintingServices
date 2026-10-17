namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The SQL Server database compatibility level EF Core generates SQL for (D-13). This is the only place
/// the number appears: re-pin it here once the hosting record (FND-13) reports the host's verified level.
/// </summary>
public static class SqlCompatibility
{
    /// <summary>The host's verified level (SQL Server 2025), re-pinned on 2026-10-16 (D-03). No JSON columns exist.</summary>
    public const int Level = 170;
}
