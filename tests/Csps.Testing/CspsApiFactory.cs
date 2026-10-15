using Csps.Infrastructure;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;

namespace Csps.Testing;

/// <summary>Hosts the real API pipeline in memory for integration tests, in the <c>Testing</c> environment.</summary>
public class CspsApiFactory : WebApplicationFactory<Program>
{
    /// <summary>The environment name every integration test runs under.</summary>
    public const string EnvironmentName = "Testing";

    /// <summary>The configuration key that turns the D-21 log file sink on or off.</summary>
    public const string LogFileSwitchKey = Csps.Server.Composition.LoggingRegistration.WriteToFileKey;

    private readonly string _connectionString;

    // True only for the parameterless constructor, whose database never exists.
    private readonly bool _withoutDatabase;

    /// <summary>
    /// Creates the factory with an https://localhost base address and a connection string to a fresh
    /// <c>CSPS_Test_&lt;guid&gt;</c> name on <c>(localdb)\MSSQLLocalDB</c> that is never created or opened. Use it for
    /// tests that do not touch the database; nothing connects at startup. Its Data Protection key ring is kept in
    /// memory (still certificate-encrypted), because the database key store would try the missing database.
    /// </summary>
    public CspsApiFactory()
        : this(UnopenedLocalDbConnectionString())
    {
        _withoutDatabase = true;
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

    /// <summary>
    /// Gets the in-memory sink that receives every Serilog event this factory's host writes. Hosts derived with
    /// <c>WithWebHostBuilder</c> share it.
    /// </summary>
    public CollectingSink Sink { get; } = new();

    /// <summary>
    /// Gets the committed stub web root (<c>Fixtures/webroot</c>, copied next to the test assembly) that every test
    /// host serves static files and the SPA shell from (WEB-01). It is named <c>webroot</c>, not <c>wwwroot</c>,
    /// because <c>.gitignore</c> ignores build output under <c>wwwroot</c>.
    /// </summary>
    public static string FixtureWebRoot { get; } = Path.Combine(AppContext.BaseDirectory, "Fixtures", "webroot");

    // Deliberately never created: pointing the static web assets manifest here turns the feature off for test hosts.
    private static string NoStaticWebAssetsManifest { get; } =
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "no-static-web-assets.runtime.json");

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment(EnvironmentName);
        builder.UseSetting(DependencyInjection.ConnectionStringKey, _connectionString);

        // Test-only JWT settings (TestJwt). Real keys never reach a test host.
        builder.UseSetting(TestJwt.IssuerSetting, TestJwt.Issuer);
        builder.UseSetting(TestJwt.AudienceSetting, TestJwt.Audience);
        builder.UseSetting(TestJwt.SigningKeySetting, TestJwt.SigningKeyBase64);

        // Test-only Data Protection certificate (TestCertificates, D-15), created in memory once per run. Rotation and
        // fail-fast tests override these two keys, or add DataProtection:PreviousCertificates, through
        // WithWebHostBuilder(b => b.UseSetting(...)), which runs after this method.
        builder.UseSetting(TestCertificates.CertificateBase64Setting, TestCertificates.Current.Base64);
        builder.UseSetting(TestCertificates.CertificatePasswordSetting, TestCertificates.Current.Password);

        // Links in emails are built from this address only (IN-06). The dispatcher is off without a database; with one
        // it sweeps every second, so a test sees its mail quickly even if the commit signal were missed.
        builder.UseSetting("App:PublicBaseUrl", "https://localhost");
        builder.UseSetting("Email:Dispatcher:Enabled", _withoutDatabase ? "false" : "true");
        builder.UseSetting("Email:Dispatcher:SweepInterval", "00:00:01");

        // Tests never write log files: the content root is src/Csps.Server, so a file sink would write into the
        // repository (research Pitfall 8). Logs go to the in-memory sink instead.
        builder.UseSetting(LogFileSwitchKey, "false");

        // The .NET suite never depends on `npm run build`: every host serves the committed fixture web root (L-06).
        builder.UseSetting(WebHostDefaults.WebRootKey, FixtureWebRoot);

        // Static web assets off: the build-time manifest always names src/Csps.Server/wwwroot, and in Development the
        // loader throws when that folder is missing, as on a fresh clone. A manifest path that does not exist is
        // ASP.NET Core's "feature not enabled", so hosts serve the fixture web root and nothing else.
        builder.UseSetting(WebHostDefaults.StaticWebAssetsKey, NoStaticWebAssetsManifest);
        builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink));

        if (_withoutDatabase)
        {
            // Replaces only the key store; the certificate encryptor stays the production one.
            builder.ConfigureTestServices(services => services.PostConfigure<KeyManagementOptions>(
                options => options.XmlRepository = new InMemoryXmlRepository()));
        }

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
