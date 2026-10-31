using Csps.LegacyFitCheck.Source;
using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck.Tests;

public sealed class LegacySourceTests
{
    private const string TestName = "CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    [Fact]
    public void TheFixedConnectionStringIsAllowed()
    {
        LegacySource.DatabaseName.ShouldBe("CSPS_Legacy_Restore");
        var check = LegacySource.Check(LegacySource.ConnectionString);

        check.Allowed.ShouldBeTrue(check.Reason);
        var builder = new SqlConnectionStringBuilder(LegacySource.ConnectionString);
        builder.InitialCatalog.ShouldBe("CSPS_Legacy_Restore");
        builder.DataSource.ShouldBe(@"(localdb)\MSSQLLocalDB");
        builder.Pooling.ShouldBeFalse();
    }

    [Theory]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;Integrated Security=true")]
    [InlineData(@"Server=(LocalDB)\mssqllocaldb;Database=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;Integrated Security=true")]
    [InlineData("Data Source=127.0.0.1,14330;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;User ID=test-user;Password=test-only-value")]
    [InlineData("Data Source=localhost,14330;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;User ID=test-user;Password=test-only-value")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=csps_legacy_restore;Integrated Security=true")]
    public void AnAllowedTargetPasses(string connectionString)
    {
        var check = LegacySource.Check(connectionString);

        check.Allowed.ShouldBeTrue(check.Reason);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("this is not a connection string")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_Dev;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_E2E;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=BetsLLC_Main;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=master;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Integrated Security=true")]
    [InlineData("Data Source=127.0.0.1,14330;Initial Catalog=CSPS_Legacy_Restore;User ID=test-user;Password=test-only-value")]
    [InlineData(@"Data Source=(localdb)\CSPS;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Data Source=np:\\.\pipe\LOCALDB#ABCDEF01\tsql\query;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData("Data Source=tcp:127.0.0.1,14330;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Data Source=127.0.0.1\SQLNAMED;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData("Data Source=secret-host-7q.example.invalid;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;AttachDBFilename=C:\secret-7q\restore.mdf;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Failover Partner=secret-host-7q.example.invalid;Initial Catalog=CSPS_Legacy_Restore;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_TEST_3F2504E0-4F89-41D3-9A0C-0305E82C3301;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c33012;Integrated Security=true")]
    public void ARefusedTargetFailsWithAFixedReason(string? connectionString)
    {
        var check = LegacySource.Check(connectionString);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
        check.Reason.ShouldNotContain("secret-host-7q");
        check.Reason.ShouldNotContain("secret-7q");
        check.Reason.ShouldNotContain("test-only-value");
        check.Reason.ShouldNotContain("CSPS_Dev");
        check.Reason.ShouldNotContain("BetsLLC");
    }

    [Theory]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;Integrated Security=true;Pooling=true;Application Name=Other")]
    [InlineData("Data Source=127.0.0.1,14330;Initial Catalog=CSPS_Test_3f2504e0-4f89-41d3-9a0c-0305e82c3301;User ID=test-user;Password=test-only-value")]
    public void PrepareForcesNoPoolingAndTheAppName(string connectionString)
    {
        LegacySource.Check(connectionString).Allowed.ShouldBeTrue();

        var prepared = new SqlConnectionStringBuilder(LegacySource.Prepare(connectionString));

        prepared.Pooling.ShouldBeFalse();
        prepared.ApplicationName.ShouldBe("Csps.LegacyFitCheck");
        prepared.InitialCatalog.ShouldBe(TestName);
    }
}
