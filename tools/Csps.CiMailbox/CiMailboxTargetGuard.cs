namespace Csps.CiMailbox;

/// <summary>The verdict of <see cref="CiMailboxTargetGuard.Check"/>.</summary>
/// <param name="Allowed">True when the tool may connect.</param>
/// <param name="DatabaseName">The database the string names, or null.</param>
/// <param name="Reason">A plain reason that never repeats the connection string.</param>
public sealed record CiMailboxTargetCheck(bool Allowed, string? DatabaseName, string Reason);

/// <summary>Decides whether the CI mailbox tool may open a connection (14 D-36). CI only; never run against a real database.</summary>
public static class CiMailboxTargetGuard
{
    /// <summary>The only database the tool may read.</summary>
    public const string DatabaseName = "CSPS_Zap";

    /// <summary>Checks a connection string and the environment.</summary>
    /// <param name="connectionString">The connection string the tool would use.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <returns>The verdict.</returns>
    public static CiMailboxTargetCheck Check(string? connectionString, Func<string, string?> getEnvironmentVariable) =>
        new(false, null, "Not implemented.");
}
