using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck;

/// <summary>The two servers the check talks to: the legacy restore it reads and the server that hosts the trial database.</summary>
/// <param name="SourceConnectionString">The legacy restore, read only.</param>
/// <param name="TrialServerConnectionString">The server template for the throwaway trial database; it names no catalog.</param>
internal sealed record FitCheckTargets(string SourceConnectionString, string TrialServerConnectionString)
{
    private const string Server = @"(localdb)\MSSQLLocalDB";
    private const string RestoreDatabase = "CSPS_Legacy_Restore";
    private const string Application = "Csps.LegacyFitCheck";

    /// <summary>The real targets. They are constants: no argument or environment value can change them.</summary>
    public static FitCheckTargets Real { get; } = new(
        new SqlConnectionStringBuilder
        {
            DataSource = Server,
            InitialCatalog = RestoreDatabase,
            IntegratedSecurity = true,
            Pooling = false,
            ApplicationName = Application,
        }.ConnectionString,
        new SqlConnectionStringBuilder
        {
            DataSource = Server,
            IntegratedSecurity = true,
            ApplicationName = Application,
        }.ConnectionString);
}
