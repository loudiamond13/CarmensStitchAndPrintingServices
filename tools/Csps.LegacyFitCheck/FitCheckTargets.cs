using Csps.LegacyFitCheck.Source;
using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck;

/// <summary>The two servers the check talks to: the legacy restore it reads and the server that hosts the trial database.</summary>
/// <param name="SourceConnectionString">The legacy restore, read only.</param>
/// <param name="TrialServerConnectionString">The server template for the throwaway trial database; it names no catalog.</param>
internal sealed record FitCheckTargets(string SourceConnectionString, string TrialServerConnectionString)
{
    /// <summary>The real targets. They are constants: no argument or environment value can change them.</summary>
    public static FitCheckTargets Real { get; } = new(
        LegacySource.ConnectionString,
        new SqlConnectionStringBuilder
        {
            DataSource = LegacySource.LocalDbInstance,
            IntegratedSecurity = true,
            ApplicationName = LegacySource.ApplicationName,
        }.ConnectionString);
}
