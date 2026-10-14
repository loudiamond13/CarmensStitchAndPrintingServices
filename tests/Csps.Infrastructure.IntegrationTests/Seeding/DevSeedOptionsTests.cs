using Csps.Infrastructure.Seeding;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>Command-line parsing of the dev-seed command (D-08).</summary>
public sealed class DevSeedOptionsTests
{
    [Fact]
    public void NoArgumentsTargetsCspsDevOnLocalDbWithoutReset()
    {
        var options = DevSeedOptions.Parse([]);

        options.Reset.ShouldBeFalse();
        options.ConnectionString.ShouldBe(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true");
    }

    [Fact]
    public void ResetFlagSetsReset()
    {
        var options = DevSeedOptions.Parse(["--reset"]);

        options.Reset.ShouldBeTrue();
        options.ConnectionString.ShouldBe(DevSeedOptions.DefaultConnectionString);
    }

    [Fact]
    public void DatabaseSwapsOnlyTheCatalog()
    {
        var options = DevSeedOptions.Parse(["--database", "CSPS_E2E", "--reset"]);

        options.Reset.ShouldBeTrue();
        var builder = new SqlConnectionStringBuilder(options.ConnectionString);
        builder.InitialCatalog.ShouldBe("CSPS_E2E");
        builder.DataSource.ShouldBe(@"(localdb)\MSSQLLocalDB");
        builder.IntegratedSecurity.ShouldBeTrue();
    }

    [Fact]
    public void ConnectionIsUsedVerbatim()
    {
        const string connectionString = "Server=localhost,1433;Database=CSPS_E2E;User ID=sa;Password=x;TrustServerCertificate=True";

        var options = DevSeedOptions.Parse(["--connection", connectionString]);

        options.ConnectionString.ShouldBe(connectionString);
        options.Reset.ShouldBeFalse();
    }

    [Theory]
    [InlineData("--wipe")]
    [InlineData("CSPS_Dev")]
    [InlineData("--RESET")]
    public void UnknownArgumentIsAUsageError(string argument)
    {
        var error = Should.Throw<ArgumentException>(() => DevSeedOptions.Parse([argument]));

        error.Message.ShouldContain(argument);
    }

    [Theory]
    [InlineData("--database")]
    [InlineData("--connection")]
    public void MissingValueIsAUsageError(string flag)
    {
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse([flag])).Message.ShouldContain(flag);
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse([flag, "--reset"])).Message.ShouldContain(flag);
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse([flag, "  "])).Message.ShouldContain(flag);
    }

    [Fact]
    public void RepeatedFlagIsAUsageError()
    {
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse(["--reset", "--reset"]));
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse(["--database", "CSPS_Dev", "--database", "CSPS_E2E"]));
    }

    [Fact]
    public void DatabaseAndConnectionTogetherIsAUsageError()
    {
        Should.Throw<ArgumentException>(() => DevSeedOptions.Parse(
            ["--database", "CSPS_E2E", "--connection", DevSeedOptions.DefaultConnectionString]));
    }
}
