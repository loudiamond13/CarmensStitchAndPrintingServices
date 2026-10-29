namespace Csps.LegacyFitCheck.Source;

/// <summary>The verdict on a source connection string.</summary>
/// <param name="Allowed">True when the tool may read this source.</param>
/// <param name="Reason">A fixed sentence. It never repeats the connection string.</param>
internal sealed record LegacySourceCheck(bool Allowed, string Reason);

/// <summary>The one legacy restore the tool may read, and the guard that refuses everything else (D-07).</summary>
internal static class LegacySource
{
    public const string DatabaseName = "CSPS_Legacy_Restore";

    public static string ConnectionString => string.Empty;

    public static LegacySourceCheck Check(string? connectionString) => new(true, "placeholder");

    public static string Prepare(string connectionString) => connectionString;
}
