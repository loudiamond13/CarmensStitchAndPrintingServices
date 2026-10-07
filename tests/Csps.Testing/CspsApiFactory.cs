using Csps.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Testing;

/// <summary>Hosts the real API pipeline in memory for integration tests, in the <c>Testing</c> environment.</summary>
public class CspsApiFactory : WebApplicationFactory<Program>
{
    /// <summary>The environment name every integration test runs under.</summary>
    public const string EnvironmentName = "Testing";

    private readonly string _connectionString;

    /// <summary>
    /// Creates the factory with an https://localhost base address and a connection string to a fresh
    /// <c>CSPS_Test_&lt;guid&gt;</c> name on <c>(localdb)\CSPS</c> that is never created or opened. Use it for
    /// tests that do not touch the database; nothing connects at startup.
    /// </summary>
    public CspsApiFactory()
        : this(UnopenedLocalDbConnectionString())
    {
    }

    /// <summary>
    /// Creates the factory against a real database, for example a <see cref="CspsDatabase"/>. Protected because
    /// an xUnit class fixture may have only one public constructor (xUnit1056): derive a fixture that passes its
    /// connection string here, or call <see cref="ForDatabase"/> for an ad-hoc factory.
    /// </summary>
    /// <param name="connectionString">The connection string the API uses.</param>
    protected CspsApiFactory(string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        _connectionString = connectionString;
        ClientOptions.BaseAddress = new Uri("https://localhost");
    }

    /// <summary>Creates an ad-hoc factory against a real database. The caller disposes it.</summary>
    /// <param name="connectionString">The connection string the API uses.</param>
    /// <returns>A new factory.</returns>
    public static CspsApiFactory ForDatabase(string connectionString) => new(connectionString);

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment(EnvironmentName);
        builder.UseSetting(DependencyInjection.ConnectionStringKey, _connectionString);
        ConfigureSettings(builder);
    }

    /// <summary>
    /// Hook for derived factories to inject configuration with <c>builder.UseSetting(key, value)</c>,
    /// which Program's top-level code can read before <c>Build()</c>.
    /// </summary>
    protected virtual void ConfigureSettings(IWebHostBuilder builder)
    {
    }

    private static string UnopenedLocalDbConnectionString() =>
        new SqlConnectionStringBuilder(SqlServerInstance.LocalDbMasterConnectionString)
        {
            InitialCatalog = TestDatabaseName.NewName(),
        }.ConnectionString;
}
