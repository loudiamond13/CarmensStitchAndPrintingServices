using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.LegacyFitCheck.Tests;

public sealed class TrialTargetTests
{
    private const string FakeSource = "CSPS_Test_00000000-0000-0000-0000-000000000001";

    [Theory]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Integrated Security=true")]
    [InlineData(@"Data Source=(LocalDB)\mssqllocaldb;Integrated Security=true")]
    [InlineData("Data Source=127.0.0.1,14330;User ID=sa;Password=Fake-Test-Only-1")]
    [InlineData("Data Source=localhost,14330;User ID=sa;Password=Fake-Test-Only-1")]
    public void AnAllowedServerPasses(string template)
    {
        var verdict = TrialTarget.Check(template);

        verdict.Allowed.ShouldBeTrue();
    }

    [Theory]
    [InlineData(@"Data Source=(localdb)\CSPS;Integrated Security=true")]
    [InlineData(@"Data Source=np:\\.\pipe\SENTINEL-PIPE\sql\query;Integrated Security=true")]
    [InlineData("Data Source=tcp:127.0.0.1,14330;Integrated Security=true")]
    [InlineData(@"Data Source=localhost\SENTINEL-INSTANCE;Integrated Security=true")]
    [InlineData("Data Source=SENTINEL-HOST.example.invalid;Integrated Security=true")]
    [InlineData("Data Source=SENTINEL-HOST.example.invalid,1433;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;AttachDBFilename=SENTINEL-FILE.mdf;Integrated Security=true")]
    [InlineData(@"Data Source=(localdb)\MSSQLLocalDB;Failover Partner=SENTINEL-PARTNER;Integrated Security=true")]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("SENTINEL-NOT-A-CONNECTION-STRING")]
    public void AnyOtherTargetIsRefusedWithAFixedReason(string? template)
    {
        var verdict = TrialTarget.Check(template);

        verdict.Allowed.ShouldBeFalse();
        verdict.Reason.ShouldNotBeNullOrWhiteSpace();
        verdict.Reason.ShouldNotContain("SENTINEL");
        verdict.Reason.ShouldNotContain("example.invalid");
        verdict.Reason.ShouldNotContain("14330");
    }

    [Fact]
    public void ForSetsOnlyTheGivenDisposableName()
    {
        var name = TrialDatabaseName.NewName();

        var connection = TrialTarget.For(@"Data Source=(localdb)\MSSQLLocalDB;Integrated Security=true;Initial Catalog=master", name, FakeSource);

        new SqlConnectionStringBuilder(connection).InitialCatalog.ShouldBe(name);
    }

    [Theory]
    [InlineData("CSPS_Dev")]
    [InlineData("CSPS_Legacy_Restore")]
    [InlineData("BetsLLC_Dev")]
    [InlineData("CSPS_Test_not-a-guid")]
    [InlineData("")]
    public void ForRefusesANameThatIsNotDisposable(string name)
    {
        var act = () => TrialTarget.For(@"Data Source=(localdb)\MSSQLLocalDB;Integrated Security=true", name, FakeSource);

        var thrown = Should.Throw<InvalidOperationException>(act);
        thrown.Message.ShouldNotContain("Integrated");
    }

    [Fact]
    public void ForRefusesTheSourceDatabaseName()
    {
        const string name = "CSPS_Test_abcdef00-0000-0000-0000-00000000000a";
        const string sameNameOtherCase = "csps_test_ABCDEF00-0000-0000-0000-00000000000A";

        var act = () => TrialTarget.For(@"Data Source=(localdb)\MSSQLLocalDB;Integrated Security=true", name, sameNameOtherCase);

        Should.Throw<InvalidOperationException>(act);
    }

    [Fact]
    public void ForRefusesAServerThatIsNotAllowed()
    {
        var act = () => TrialTarget.For("Data Source=SENTINEL-HOST.example.invalid;Integrated Security=true", TrialDatabaseName.NewName(), FakeSource);

        var thrown = Should.Throw<InvalidOperationException>(act);
        thrown.Message.ShouldNotContain("SENTINEL");
    }

    [Fact]
    public async Task TheCompatibilityLevelMustMatch()
    {
        var token = TestContext.Current.CancellationToken;
        var server = await SqlServerInstance.GetSharedAsync();
        var old = await CspsDatabase.CreateEmptyAsync(150);
        await using (old.ConfigureAwait(true))
        {
            var act = () => TrialDatabase.CheckCompatibilityAsync(server.MasterConnectionString, old.DatabaseName, token);

            await Should.ThrowAsync<InvalidOperationException>(act);
        }

        var current = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (current.ConfigureAwait(true))
        {
            await TrialDatabase.CheckCompatibilityAsync(server.MasterConnectionString, current.DatabaseName, token);
        }
    }
}
