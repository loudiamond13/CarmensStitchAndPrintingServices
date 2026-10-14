using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace Csps.Testing;

/// <summary>
/// The SQL Server every integration test in the process shares (D-05, D-07, FND-11). Created lazily once per
/// process through <see cref="GetSharedAsync"/>, so no assembly-fixture declaration is needed in any test project.
/// <list type="bullet">
/// <item><c>CSPS_TEST_SQL</c> unset or <c>localdb</c>: the dedicated <c>(localdb)\CSPS</c> instance. Never the
/// shared <c>MSSQLLocalDB</c> instance.</item>
/// <item><c>CSPS_TEST_SQL=container</c> (CI only): a Testcontainers SQL Server 2025 container. Docker is never
/// touched unless this value is set for the test process.</item>
/// </list>
/// </summary>
public sealed class SqlServerInstance
{
    /// <summary>Master-database connection string of the dedicated LocalDB instance (integrated security, no secret).</summary>
    public const string LocalDbMasterConnectionString = @"Server=(localdb)\CSPS;Database=master;Integrated Security=true";

    /// <summary>The explicit SQL Server image the CI container uses (never <c>latest</c>).</summary>
    public const string ContainerImage = "mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04";

    private static readonly Lazy<Task<SqlServerInstance>> Shared = new(CreateAsync, LazyThreadSafetyMode.ExecutionAndPublication);

    private SqlServerInstance(SqlBackend backend, string masterConnectionString)
    {
        Backend = backend;
        MasterConnectionString = masterConnectionString;
    }

    /// <summary>The backend selected from <c>CSPS_TEST_SQL</c>.</summary>
    public SqlBackend Backend { get; }

    /// <summary>Connection string to the server's <c>master</c> database, used for CREATE/DROP DATABASE.</summary>
    public string MasterConnectionString { get; }

    /// <summary>Returns the process-wide instance, starting it on first use.</summary>
    /// <returns>The shared SQL Server.</returns>
    public static Task<SqlServerInstance> GetSharedAsync() => Shared.Value;

    /// <summary>Builds a connection string for one database on this server.</summary>
    /// <param name="databaseName">The database (initial catalog).</param>
    /// <returns>The connection string.</returns>
    public string ConnectionStringFor(string databaseName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(databaseName);
        return new SqlConnectionStringBuilder(MasterConnectionString) { InitialCatalog = databaseName }.ConnectionString;
    }

    private static async Task<SqlServerInstance> CreateAsync()
    {
        // Read from the process environment only: the variable is never set at User or Machine level.
        var backend = SqlBackend.From(
            Environment.GetEnvironmentVariable(SqlBackendSelection.EnvironmentVariable),
            OperatingSystem.IsWindows());

        if (backend == SqlBackend.LocalDb)
        {
            return new SqlServerInstance(backend, LocalDbMasterConnectionString);
        }

        // Disposed by the Testcontainers resource reaper when the test process exits.
        var container = new MsSqlBuilder(ContainerImage).Build();
        await container.StartAsync().ConfigureAwait(false);
        return new SqlServerInstance(backend, container.GetConnectionString());
    }
}
