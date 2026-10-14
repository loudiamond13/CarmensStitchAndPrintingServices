using Csps.Infrastructure.Seeding;
using Csps.Testing;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>
/// FND-04 boundary and empty edges, T-01-13: the dev seed may touch only CSPS_Dev and CSPS_E2E, and only on
/// (localdb)\MSSQLLocalDB or a loopback container. TheBETSLLC shares that instance, so its databases must be refused.
/// </summary>
public sealed class DevSeedTargetGuardTests
{
    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true", "CSPS_Dev")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true", "CSPS_E2E")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Initial Catalog=csps_dev;Integrated Security=true", "csps_dev")]
    [InlineData("Server=localhost,1433;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1;TrustServerCertificate=True", "CSPS_E2E")]
    [InlineData(@"Data Source=(LocalDB)\mssqllocaldb;Initial Catalog=CSPS_E2E;Integrated Security=true", "CSPS_E2E")]
    [InlineData("Server=127.0.0.1,32768;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1;TrustServerCertificate=True", "CSPS_E2E")]
    public void AllowsOnlyTheTwoDevDatabases(string connectionString, string expectedDatabase)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeTrue(check.Reason);
        check.DatabaseName.ShouldBe(expectedDatabase);
        check.Reason.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev2;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_De;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev_;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_Dev;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=master;Integrated Security=true")]
    [InlineData("Server=127.0.0.1,32768;Database=BetsLLC_Dev;User ID=sa;Password=NotARealSecret1;TrustServerCertificate=True")]
    public void RefusesEveryOtherDatabase(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Initial Catalog=;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=   ;Integrated Security=true")]
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
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Not A Keyword=1")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=maybe")]
    public void RefusesAnUnparseableConnectionString(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("could not be read");
    }

    [Theory]
    [InlineData(@"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Data Source=(LocalDB)\csps;Initial Catalog=CSPS_E2E;Integrated Security=true")]
    public void RefusesTheRetiredCspsLocalDbInstance(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain(@"(localdb)\MSSQLLocalDB");
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_Dev;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_E2E;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_Test_0f8fad5b-d9cb-469f-a165-70867728950e;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=betsllc_dev;Integrated Security=true")]
    public void RefusesTheOtherProjectsDatabasesOnTheSharedInstance(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("is not CSPS_Dev or CSPS_E2E");
    }

    [Theory]
    [InlineData("Server=sql1234.site4now.net;Database=CSPS_E2E;User ID=csps;Password=NotARealSecret1")]
    [InlineData("Server=tcp:sql1234.site4now.net,1433;Database=CSPS_Dev;User ID=csps;Password=NotARealSecret1")]
    [InlineData("Address=sql1234.site4now.net;Database=CSPS_E2E;User ID=csps;Password=NotARealSecret1")]
    [InlineData("Server=203.0.113.10;Database=CSPS_E2E;User ID=csps;Password=NotARealSecret1")]
    [InlineData(@"Server=np:\\.\pipe\LOCALDB#351DA954\tsql\query;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\.\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB2;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData("Server=localhost;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData("Server=127.0.0.1;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData(@"Server=localhost\SQLEXPRESS;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData("Server=.;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData("Server=(local);Database=CSPS_Dev;Integrated Security=true")]
    [InlineData("Server=tcp:localhost,1433;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=localhost,0;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=localhost,65536;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=localhost,14x3;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=localhost,1433,1434;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=127.0.0.2,1433;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    [InlineData("Server=localhost.example.com,1433;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1")]
    public void RefusesEveryServerOutsideTheAllowList(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain(@"(localdb)\MSSQLLocalDB");
        check.Reason.ShouldNotContain("NotARealSecret1");
        check.Reason.ShouldNotContain("site4now");
        check.Reason.ShouldNotContain("203.0.113");
        check.Reason.ShouldNotContain("LOCALDB#351DA954");
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Failover Partner=sql1234.site4now.net;Database=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Server=127.0.0.1,32768;Failover Partner=(localdb)\MSSQLLocalDB;Database=CSPS_E2E;User ID=sa;Password=NotARealSecret1;TrustServerCertificate=True")]
    public void RefusesAFailoverPartner(string connectionString)
    {
        var check = DevSeedTargetGuard.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("Failover Partner");
        check.Reason.ShouldNotContain("site4now");
        check.Reason.ShouldNotContain("NotARealSecret1");
    }

    [Fact]
    public async Task AllowsTheServerTheTestFixtureUses()
    {
        var server = await SqlServerInstance.GetSharedAsync();

        var check = DevSeedTargetGuard.Check(server.ConnectionStringFor(DevSeedTargetGuard.E2EDatabase));

        check.Allowed.ShouldBeTrue(check.Reason);
        check.DatabaseName.ShouldBe(DevSeedTargetGuard.E2EDatabase);
    }

    [Fact]
    public void RefusesAnyAttachDbFilename()
    {
        var check = DevSeedTargetGuard.Check(
            @"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;AttachDBFilename=C:\Data\CSPS_Dev.mdf;Integrated Security=true");

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
