using Csps.Testing;

namespace Csps.Infrastructure.IntegrationTests.Fixture;

/// <summary>Backend selection from <c>CSPS_TEST_SQL</c> (D-07). Pure: no environment is read here.</summary>
public sealed class SqlBackendTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("localdb")]
    [InlineData("LocalDB")]
    public void UnsetOrLocalDbSelectsLocalDbOnWindows(string? value)
    {
        SqlBackend.From(value, isWindows: true).ShouldBe(SqlBackend.LocalDb);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ContainerSelectsContainer(bool isWindows)
    {
        SqlBackend.From("container", isWindows).ShouldBe(SqlBackend.Container);
    }

    [Theory]
    [InlineData("docker")]
    [InlineData("mssqllocaldb")]
    [InlineData("sqlserver")]
    public void UnknownValueFailsNamingTheVariable(string value)
    {
        var error = Should.Throw<InvalidOperationException>(() => SqlBackend.From(value, isWindows: true));

        error.Message.ShouldContain("CSPS_TEST_SQL");
        error.Message.ShouldContain(value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("localdb")]
    public void LocalDbOffWindowsTellsCiToUseTheContainer(string? value)
    {
        var error = Should.Throw<InvalidOperationException>(() => SqlBackend.From(value, isWindows: false));

        error.Message.ShouldContain("CSPS_TEST_SQL=container");
    }

    [Fact]
    public void LocalDbTargetsTheDefaultInstance()
    {
        SqlServerInstance.LocalDbMasterConnectionString.ShouldContain(@"(localdb)\MSSQLLocalDB;");
        SqlServerInstance.LocalDbMasterConnectionString.ShouldNotContain(@"(localdb)\CSPS", Case.Insensitive);
    }

    [Fact]
    public void ContainerImageIsPinnedExplicitly()
    {
        SqlServerInstance.ContainerImage.ShouldBe("mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04");
    }
}
