using Csps.Infrastructure.Seeding;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>
/// FND-04 boundary and empty edges, T-01-13: the dev seed may touch only CSPS_Dev and CSPS_E2E, never another
/// project's database, the shared MSSQLLocalDB instance, an attached file or anything it cannot read.
/// </summary>
public sealed class DevSeedTargetGuardTests
{
    [Theory]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=true", "CSPS_Dev")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_E2E;Integrated Security=true", "CSPS_E2E")]
    [InlineData(@"Server=(localdb)\CSPS;Initial Catalog=csps_dev;Integrated Security=true", "csps_dev")]
    [InlineData("Server=localhost,1433;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1;TrustServerCertificate=True", "CSPS_E2E")]
    public void AllowsOnlyTheTwoDevDatabases(string connectionString, string expectedDatabase)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeTrue(check.Reason);
        check.DatabaseName.ShouldBe(expectedDatabase);
        check.Reason.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev2;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_De;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev_;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=BetsLLC_Dev;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=master;Integrated Security=true")]
    public void RefusesEveryOtherDatabase(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData(@"Server=(localdb)\CSPS;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Initial Catalog=;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\CSPS;Database=   ;Integrated Security=true")]
    public void RefusesAMissingOrEmptyCatalog(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("no database");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void RefusesAnEmptyConnectionString(string? connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.DatabaseName.ShouldBeNull();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData("this is not a connection string")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev;Not A Keyword=1")]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=maybe")]
    public void RefusesAnUnparseableConnectionString(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("could not be read");
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Data Source=(LocalDB)\mssqllocaldb;Initial Catalog=CSPS_E2E;Integrated Security=true")]
    public void RefusesTheSharedMssqlLocalDbInstance(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("MSSQLLocalDB");
    }

    [Fact]
    public void RefusesAnyAttachDbFilename()
    {
        var check = DevSeedTargetGuard.Check(
            @"Server=(localdb)\CSPS;Database=CSPS_Dev;AttachDBFilename=C:\Data\CSPS_Dev.mdf;Integrated Security=true");

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("AttachDBFilename");
    }

    [Fact]
    public void ReasonNeverEchoesTheConnectionString()
    {
        var check = DevSeedTargetGuard.Check("Server=prod.example;Database=BetsLLC_Dev;User ID=sa;Password=Sup3rSecret!");

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotContain("Sup3rSecret!");
        check.Reason.ShouldNotContain("prod.example");
    }
}
