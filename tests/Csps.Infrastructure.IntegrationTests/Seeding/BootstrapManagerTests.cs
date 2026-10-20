using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Infrastructure.Seeding;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using BootstrapProgram = Csps.BootstrapManager.Program;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>
/// AUTH-12, D-29, CWE-214: the bootstrap-manager command refuses the wrong database, takes its connection string
/// only from the environment or a prompt, and creates the first Manager with one queued invite on an empty database.
/// </summary>
public sealed class BootstrapManagerTests
{
    private const string Password = "NotARealSecret1";
    private const string PublicBaseUrl = "https://csps.example.test";

    // The protected name is kept but the host cannot resolve, so a guard regression fails to connect instead of reaching the shared instance.
    private const string UnreachableBetsConnection = "Server=db.invalid.example;Database=BetsLLC_Dev;Integrated Security=true;Connect Timeout=1";

    [Theory]
    [InlineData("Server=db.example.net;Database=CspsLive;User ID=app;Password=NotARealSecret1;Encrypt=True", "CspsLive")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true", "CSPS_Dev")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=csps_e2e;Integrated Security=true", "csps_e2e")]
    [InlineData("Server=127.0.0.1,32768;Database=CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e;User ID=sa;Password=NotARealSecret1", "CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e")]
    [InlineData("Server=tcp:db.example.com,1433;Database=Other_Db;User ID=app;Password=NotARealSecret1", "Other_Db")]
    [InlineData(@"Server=np:\\db.example.com\pipe\sql\query;Database=Other_Db;Integrated Security=true", "Other_Db")]
    [InlineData("Server=tcp:[::1],1433;Database=CSPS_Dev;User ID=sa;Password=NotARealSecret1", "CSPS_Dev")]
    [InlineData(@"Server=np:\\.\pipe\LOCALDB#ABC123\tsql\query;Database=CSPS_E2E;Integrated Security=true", "CSPS_E2E")]
    public void GuardAllowsAConfirmedDatabase(string connectionString, string database)
    {
        var check = BootstrapTargetGuard.Check(connectionString, database);

        check.Allowed.ShouldBeTrue(check.Reason);
        check.DatabaseName.ShouldBe(database);
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_Dev;Integrated Security=true", "BetsLLC_Dev")]
    [InlineData(@"Server=db.example.net;Database=betsllc_live;User ID=app;Password=NotARealSecret1", "betsllc_live")]
    [InlineData(@"Server=db.example.net;Database=CSPS_Legacy_Restore;User ID=app;Password=NotARealSecret1", "CSPS_Legacy_Restore")]
    [InlineData(@"Server=db.example.net;Database=csps_legacy_restore;User ID=app;Password=NotARealSecret1", "csps_legacy_restore")]
    [InlineData(@"Server=db.example.net;Database=master;User ID=app;Password=NotARealSecret1", "master")]
    [InlineData(@"Server=db.example.net;Database=tempdb;User ID=app;Password=NotARealSecret1", "tempdb")]
    public void GuardRefusesProtectedDatabasesEvenWhenConfirmed(string connectionString, string database)
    {
        var check = BootstrapTargetGuard.Check(connectionString, database);

        check.Allowed.ShouldBeFalse();
        AssertSafeReason(check, connectionString);
    }

    [Theory]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=SomethingElse;Integrated Security=true", "SomethingElse")]
    [InlineData(@"Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev2;Integrated Security=true", "CSPS_Dev2")]
    [InlineData("Server=localhost,1433;Database=Anything;User ID=sa;Password=NotARealSecret1", "Anything")]
    [InlineData("Server=tcp:[::1],1433;Database=Other_Db;User ID=sa;Password=NotARealSecret1", "Other_Db")]
    [InlineData("Server=[::1],1433;Database=Other_Db;User ID=sa;Password=NotARealSecret1", "Other_Db")]
    [InlineData(@"Server=np:\\.\pipe\LOCALDB#ABC123\tsql\query;Database=Other_Db;Integrated Security=true", "Other_Db")]
    [InlineData(@"Server=np:\\localhost\pipe\sql\query;Database=Other_Db;Integrated Security=true", "Other_Db")]
    public void GuardAllowsOnlyTheCspsDatabasesOnThisMachine(string connectionString, string database)
    {
        var check = BootstrapTargetGuard.Check(connectionString, database);

        check.Allowed.ShouldBeFalse();
        AssertSafeReason(check, connectionString);
    }

    [Theory]
    [InlineData("Server=db.example.net;Database=CspsLive;User ID=app;Password=NotARealSecret1", "CspsOther")]
    [InlineData("Server=db.example.net;Database=CspsLive;User ID=app;Password=NotARealSecret1", "")]
    [InlineData("Server=db.example.net;Database=CspsLive;User ID=app;Password=NotARealSecret1", "   ")]
    [InlineData("Server=db.example.net;Database=CspsLive;User ID=app;Password=NotARealSecret1", null)]
    public void GuardRefusesAMissingOrDifferentConfirmation(string connectionString, string? confirmed)
    {
        var check = BootstrapTargetGuard.Check(connectionString, confirmed);

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain("--confirm-database");
        AssertSafeReason(check, connectionString);
    }

    [Theory]
    [InlineData(@"Server=db.example.net;Database=CspsLive;AttachDBFilename=C:\data\live.mdf;User ID=app;Password=NotARealSecret1", "AttachDBFilename")]
    [InlineData("Server=db.example.net;Database=CspsLive;Failover Partner=other.example.net;User ID=app;Password=NotARealSecret1", "Failover Partner")]
    public void GuardRefusesFileAttachAndFailoverPartner(string connectionString, string keyword)
    {
        var check = BootstrapTargetGuard.Check(connectionString, "CspsLive");

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldContain(keyword);
        AssertSafeReason(check, connectionString);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("this is not a connection string; Password=NotARealSecret1")]
    [InlineData("Server=db.example.net;Database=CspsLive;Not A Keyword=NotARealSecret1")]
    [InlineData("Server=db.example.net;User ID=app;Password=NotARealSecret1")]
    [InlineData("Server=db.example.net;Initial Catalog=;User ID=app;Password=NotARealSecret1")]
    public void GuardRefusesAnEmptyUnreadableOrDatabaselessConnectionString(string? connectionString)
    {
        var check = BootstrapTargetGuard.Check(connectionString, "CspsLive");

        check.Allowed.ShouldBeFalse();
        check.Reason.ShouldNotBeNullOrWhiteSpace();
        AssertSafeReason(check, connectionString);
    }

    [Fact]
    public void OptionsParseEveryArgumentAndTheEnvironmentConnection()
    {
        var options = BootstrapManagerOptions.Parse(
            ["--email", "carmen@csps.test", "--first-name", "Carmen", "--last-name", "Reyes", "--confirm-database", "CspsLive", "--public-base-url", PublicBaseUrl],
            Environment(Connection("CspsLive")));

        options.Email.ShouldBe("carmen@csps.test");
        options.FirstName.ShouldBe("Carmen");
        options.LastName.ShouldBe("Reyes");
        options.ConfirmDatabase.ShouldBe("CspsLive");
        options.PublicBaseUrl.ShouldBe(PublicBaseUrl);
        options.ConnectionString.ShouldBe(Connection("CspsLive"));
    }

    [Fact]
    public void OptionsLeaveTheConnectionEmptyWhenTheVariableIsNotSet()
    {
        var options = BootstrapManagerOptions.Parse(RequiredArguments(), static _ => null);

        options.ConnectionString.ShouldBeNull();
        options.PublicBaseUrl.ShouldBeNull();
        options.WithConnectionString("Server=x").ConnectionString.ShouldBe("Server=x");
    }

    [Theory]
    [InlineData("--connection", "Server=db;Database=CspsLive;Password=NotARealSecret1")]
    [InlineData("--connection=Server=db;Database=CspsLive;Password=NotARealSecret1", null)]
    [InlineData("--connection-string", "Server=db;Password=NotARealSecret1")]
    public void OptionsRejectAConnectionArgumentWithoutEchoingIt(string first, string? second)
    {
        string[] args = second is null ? [.. RequiredArguments(), first] : [.. RequiredArguments(), first, second];

        var error = Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse(args, static _ => null));

        error.Message.ShouldContain(BootstrapManagerOptions.ConnectionVariable);
        error.Message.ShouldNotContain(Password);
        error.Message.ShouldNotContain("Server=db");
    }

    [Theory]
    [InlineData("--email")]
    [InlineData("--first-name")]
    [InlineData("--last-name")]
    [InlineData("--confirm-database")]
    public void OptionsRequireEachNamedValue(string missing)
    {
        var args = RequiredArguments();
        var index = Array.IndexOf(args, missing);
        string[] without = [.. args[..index], .. args[(index + 2)..]];

        var error = Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse(without, static _ => null));

        error.Message.ShouldContain(missing);
        error.Message.ShouldContain("Usage:");
    }

    [Fact]
    public void OptionsRejectARepeatedAnUnknownOrValuelessArgument()
    {
        Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse([.. RequiredArguments(), "--email", "x"], static _ => null));
        Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse([.. RequiredArguments(), "--unknown=NotARealSecret1"], static _ => null))
            .Message.ShouldNotContain(Password);
        Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse([.. RequiredArguments(), "NotARealSecret1"], static _ => null))
            .Message.ShouldNotContain(Password);
        Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse([.. RequiredArguments(), "--public-base-url"], static _ => null));
        Should.Throw<ArgumentException>(() => BootstrapManagerOptions.Parse(["--email", "--first-name", "Carmen"], static _ => null));
    }

    [Fact]
    public void SystemRequestContextHasNoUserIpOrSessionAndARandomW3CCorrelationId()
    {
        var first = new SystemRequestContext();
        var second = new SystemRequestContext();

        first.UserId.ShouldBeNull();
        first.SessionId.ShouldBeNull();
        first.RemoteIp.ShouldBeNull();
        first.UserAgent.ShouldBeNull();
        first.CorrelationId.Length.ShouldBe(32);
        first.CorrelationId.ShouldMatch("^[0-9a-f]{32}$");
        first.CorrelationId.ShouldBe(first.CorrelationId);
        first.CorrelationId.ShouldNotBe(second.CorrelationId);
    }

    [Fact]
    public async Task ARunOnAnEmptyDatabaseCreatesTheFirstManagerWithOneQueuedInviteAndASecondRunIsRefused()
    {
        await using var database = await CspsDatabase.CreateAsync();
        const string Email = "carmen@csps.test";

        var first = await RunAsync(database, Email);

        first.ExitCode.ShouldBe(0, first.Error);
        first.Output.ShouldContain($"Invite queued for {Email}. The running CSPS site sends it within a minute.");
        first.Error.ShouldBeEmpty();
        first.Output.ShouldNotContain(database.ConnectionString);

        await using (var context = database.CreateContext())
        {
            var user = await context.Users.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
            user.Email.ShouldBe(Email);
            user.IsActive.ShouldBeTrue();
            user.EmailConfirmed.ShouldBeFalse("the email is confirmed when the invite is accepted");
            user.PasswordHash.ShouldBeNull();
            (await context.EmailOutbox.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
            (await context.AccountTokens.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);

            var key = user.Id.ToString("D");
            var audit = await context.AuditLog.AsNoTracking().Where(entry => entry.TargetId == key).ToListAsync(TestContext.Current.CancellationToken);
            audit.Single(entry => entry.Action == AuditActions.BootstrapManagerCreated).ActorUserId.ShouldBeNull();
            audit.Single(entry => entry.Action == AuditActions.UserInvited).ActorUserId.ShouldBeNull();
        }

        var second = await RunAsync(database, "other@csps.test");

        second.ExitCode.ShouldBe(2);
        second.Error.ShouldContain("An active Manager already exists");
        second.Output.ShouldBeEmpty();
        await using var after = database.CreateContext();
        (await after.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await after.EmailOutbox.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Theory]
    [InlineData("locked")]
    [InlineData("deleted")]
    [InlineData("deactivated")]
    public async Task ARunCreatesANewManagerWhenTheOnlyManagerCannotAct(string state)
    {
        await using var database = await CspsDatabase.CreateAsync();
        (await RunAsync(database, "carmen@csps.test")).ExitCode.ShouldBe(0);
        var stamp = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);
        await using (var context = database.CreateContext())
        {
            _ = state switch
            {
                "locked" => await context.Users.ExecuteUpdateAsync(set => set.SetProperty(user => user.ManagerLockedAtUtc, stamp), TestContext.Current.CancellationToken),
                "deleted" => await context.Users.ExecuteUpdateAsync(set => set.SetProperty(user => user.DeletedAtUtc, stamp), TestContext.Current.CancellationToken),
                _ => await context.Users.ExecuteUpdateAsync(set => set.SetProperty(user => user.IsActive, false), TestContext.Current.CancellationToken),
            };
        }

        var recovery = await RunAsync(database, "other@csps.test");

        recovery.ExitCode.ShouldBe(0, recovery.Error);
        recovery.Output.ShouldContain("Invite queued for other@csps.test.");
        await using var after = database.CreateContext();
        (await after.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(2);
        var created = await after.Users.AsNoTracking().SingleAsync(user => user.Email == "other@csps.test", TestContext.Current.CancellationToken);
        (await after.UserRoles.AsNoTracking().CountAsync(
            link => link.UserId == created.Id && after.Roles.Any(role => role.Id == link.RoleId && role.Name == Roles.Manager),
            TestContext.Current.CancellationToken)).ShouldBe(1);
        (await after.AccountTokens.AsNoTracking().CountAsync(token => token.UserId == created.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await after.EmailOutbox.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    [Fact]
    public async Task AReusedEmailIsRefusedInPlainWords()
    {
        await using var database = await CspsDatabase.CreateAsync();
        const string Email = "carmen@csps.test";
        (await RunAsync(database, Email)).ExitCode.ShouldBe(0);
        await using (var context = database.CreateContext())
        {
            await context.Users.ExecuteUpdateAsync(set => set.SetProperty(user => user.IsActive, false), TestContext.Current.CancellationToken);
        }

        var again = await RunAsync(database, Email);

        again.ExitCode.ShouldBe(2);
        again.Error.ShouldContain("An account with that email already exists");
        await using var after = database.CreateContext();
        (await after.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ABadEmailIsAUsageErrorAndCreatesNothing()
    {
        await using var database = await CspsDatabase.CreateAsync();

        var run = await RunAsync(database, "not-an-email");

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldContain("email");
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AWrongConfirmationIsRefusedBeforeAnyDatabaseWork()
    {
        await using var database = await CspsDatabase.CreateAsync();

        var run = await RunAsync(database, "carmen@csps.test", confirmDatabase: "CSPS_Dev");

        run.ExitCode.ShouldBe(2);
        run.Error.ShouldContain("--confirm-database");
        run.Error.ShouldNotContain(database.ConnectionString);
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ABetsDatabaseIsRefusedWithoutOpeningAConnection()
    {
        var run = await RunCommandAsync(
            ["--email", "carmen@csps.test", "--first-name", "Carmen", "--last-name", "Reyes", "--confirm-database", "BetsLLC_Dev", "--public-base-url", PublicBaseUrl],
            Environment(UnreachableBetsConnection),
            prompt: null);

        run.ExitCode.ShouldBe(2);
        run.Error.ShouldContain("BetsLLC_");
    }

    [Fact]
    public async Task AMissingConnectionWithNoPromptIsAUsageError()
    {
        var run = await RunCommandAsync(RequiredArguments(), static _ => null, prompt: null);

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldContain(BootstrapManagerOptions.ConnectionVariable);
    }

    [Fact]
    public async Task APromptedConnectionIsUsedWhenTheVariableIsNotSet()
    {
        var run = await RunCommandAsync(
            ["--email", "carmen@csps.test", "--first-name", "Carmen", "--last-name", "Reyes", "--confirm-database", "BetsLLC_Dev", "--public-base-url", PublicBaseUrl],
            static _ => null,
            prompt: () => UnreachableBetsConnection);

        run.ExitCode.ShouldBe(2);
        run.Error.ShouldContain("BetsLLC_");
    }

    [Fact]
    public async Task AConnectionArgumentIsAUsageErrorThatNeverEchoesIt()
    {
        var run = await RunCommandAsync([.. RequiredArguments(), "--connection", "Server=db;Password=NotARealSecret1"], static _ => null, prompt: null);

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldNotContain(Password);
        run.Output.ShouldNotContain(Password);
    }

    [Fact]
    public async Task AnUnusablePublicBaseUrlIsAUsageError()
    {
        await using var database = await CspsDatabase.CreateAsync();

        var run = await RunAsync(database, "carmen@csps.test", baseUrl: "http://csps.example.test");

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldContain("App:PublicBaseUrl");
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    private static void AssertSafeReason(BootstrapTargetCheck check, string? connectionString)
    {
        check.Reason.ShouldNotBeNullOrWhiteSpace();
        check.Reason.ShouldNotContain(Password);
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            check.Reason.ShouldNotContain(connectionString);
        }
    }

    private static string Connection(string database) =>
        $"Server=db.example.net;Database={database};User ID=app;Password={Password};Encrypt=True";

    private static Func<string, string?> Environment(string connection) =>
        name => name == BootstrapManagerOptions.ConnectionVariable ? connection : null;

    private static string[] RequiredArguments() =>
        ["--email", "carmen@csps.test", "--first-name", "Carmen", "--last-name", "Reyes", "--confirm-database", "CspsLive"];

    private static Task<CommandRun> RunAsync(CspsDatabase database, string email, string? confirmDatabase = null, string baseUrl = PublicBaseUrl) =>
        RunCommandAsync(
            ["--email", email, "--first-name", "Carmen", "--last-name", "Reyes", "--confirm-database", confirmDatabase ?? database.DatabaseName, "--public-base-url", baseUrl],
            Environment(database.ConnectionString),
            prompt: null);

    private static async Task<CommandRun> RunCommandAsync(string[] args, Func<string, string?> environment, Func<string?>? prompt)
    {
        var settings = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
                [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
            })
            .Build();
        var output = new StringWriter();
        var error = new StringWriter();

        var exitCode = await BootstrapProgram.RunAsync(args, environment, settings, prompt, output, error, TestContext.Current.CancellationToken);

        return new CommandRun(exitCode, output.ToString(), error.ToString());
    }

    private sealed record CommandRun(int ExitCode, string Output, string Error);
}
