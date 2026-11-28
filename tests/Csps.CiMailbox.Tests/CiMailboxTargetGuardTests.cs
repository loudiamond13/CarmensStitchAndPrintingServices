using Csps.CiMailbox;

namespace Csps.CiMailbox.Tests;

/// <summary>
/// 14 D-36, T-14-08: the CI mailbox tool may open a connection only inside GitHub Actions, only to a loopback container
/// (127.0.0.1 or localhost with a port), and only to the database CSPS_Zap.
/// </summary>
public sealed class CiMailboxTargetGuardTests
{
    private const string Secret = "NotARealSecret1";

    [Theory]
    [InlineData($"Server=127.0.0.1,1433;Database=CSPS_Zap;User ID=sa;Password={Secret};TrustServerCertificate=True")]
    [InlineData($"Server=localhost,14330;Database=CSPS_Zap;User ID=sa;Password={Secret};TrustServerCertificate=True")]
    [InlineData($"Data Source=LOCALHOST,14330;Initial Catalog=csps_zap;User ID=sa;Password={Secret};TrustServerCertificate=True")]
    public void AllowsTheLoopbackContainerDatabaseInsideGitHubActions(string connectionString)
    {
        var check = CiMailboxTargetGuard.Check(connectionString, Environment("true"));

        check.Allowed.ShouldBeTrue(check.Reason);
        check.DatabaseName.ShouldNotBeNull().ShouldBe(CiMailboxTargetGuard.DatabaseName, StringCompareShould.IgnoreCase);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("false")]
    [InlineData("True")]
    [InlineData("1")]
    public void RefusesAnAllowedTargetOutsideGitHubActions(string? githubActions)
    {
        var check = CiMailboxTargetGuard.Check(
            $"Server=127.0.0.1,1433;Database=CSPS_Zap;User ID=sa;Password={Secret};TrustServerCertificate=True", Environment(githubActions));

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("GitHub Actions");
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Zap;Integrated Security=true")]
    [InlineData($"Server=127.0.0.1;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=127.0.0.1,;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=localhost,0;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=localhost,65536;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=tcp:127.0.0.1,1433;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=db.example.net,1433;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=10.0.0.5,1433;Database=CSPS_Zap;User ID=sa;Password={Secret}")]
    [InlineData($"Server=127.0.0.1,1433;Database=CSPS_Zap;Failover Partner=db.example.net;User ID=sa;Password={Secret}")]
    [InlineData($"Server=127.0.0.1,1433;Database=CSPS_Zap;AttachDBFilename=C:\\data\\x.mdf;User ID=sa;Password={Secret}")]
    public void RefusesEveryOtherServer(string connectionString)
    {
        var check = CiMailboxTargetGuard.Check(connectionString, Environment("true"));

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
        check.Reason.ShouldNotContain(Secret);
    }

    [Theory]
    [InlineData("CSPS_Dev")]
    [InlineData("CSPS_E2E")]
    [InlineData("CSPS_Legacy_Restore")]
    [InlineData("CSPS_Zap2")]
    [InlineData("CSPS_Za")]
    [InlineData("CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e")]
    [InlineData("BetsLLC_Dev")]
    [InlineData("master")]
    public void RefusesEveryOtherDatabase(string database)
    {
        var check = CiMailboxTargetGuard.Check(
            $"Server=127.0.0.1,1433;Database={database};User ID=sa;Password={Secret};TrustServerCertificate=True", Environment("true"));

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotContain(Secret);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("this is not a connection string")]
    [InlineData($"Server=127.0.0.1,1433;User ID=sa;Password={Secret}")]
    [InlineData($"Server=127.0.0.1,1433;Initial Catalog=;User ID=sa;Password={Secret}")]
    public void RefusesAMissingUnreadableOrNamelessConnectionString(string? connectionString)
    {
        var check = CiMailboxTargetGuard.Check(connectionString, Environment("true"));

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
        check.Reason.ShouldNotContain(Secret);
    }

    internal static Func<string, string?> Environment(string? githubActions) =>
        name => name == "GITHUB_ACTIONS" ? githubActions : null;
}
