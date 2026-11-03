using System.Text.Json;
using Csps.Infrastructure.Maintenance;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Csps.HostProbe.Tests;

/// <summary>D-42, D-45: the probe's backup check reports facts only and never a path, a name or an exception message.</summary>
public sealed class BackupCheckTests : IDisposable
{
    private const string FakeConnectionString = "Server=probe.test.invalid;Database=csps_fake_db;Integrated Security=true";
    private const string FakeSqlFolder = """C:\fake\sqlfolder""";
    private const string ExpectedFileName = "csps-probe-20261102-191700.bak.part";

    private readonly string _appFolder = Path.Combine(Path.GetTempPath(), "csps-backup-test-" + Guid.NewGuid().ToString("N"));
    private readonly string _contentRoot = Path.Combine(Path.GetTempPath(), "csps-backup-test-" + Guid.NewGuid().ToString("N"));
    private readonly FixedClock _clock = new(new DateTimeOffset(2026, 11, 2, 19, 17, 0, TimeSpan.Zero));

    public BackupCheckTests() => Directory.CreateDirectory(_appFolder);

    public void Dispose()
    {
        foreach (var folder in new[] { _appFolder, _contentRoot })
        {
            if (Directory.Exists(folder))
            {
                Directory.Delete(folder, recursive: true);
            }
        }
    }

    [Fact]
    public async Task AWrittenFileIsSeenSizedRenamedDeletedAndConfirmedGone()
    {
        var call = new Recorder();
        BackupRunner runner = (connection, folder, file, timeout, time, token) =>
        {
            call.Record(connection, folder, file, timeout);
            File.WriteAllBytes(Path.Combine(_appFolder, file), new byte[3 * 1024 * 1024]);
            return Task.FromResult(new BackupStatementOutcome(true, null, false, [], TimeSpan.FromSeconds(2.5)));
        };

        var facts = await BackupCheck.RunAsync(Settings(_appFolder), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeTrue();
        facts.FileName.ShouldBe(ExpectedFileName);
        facts.Seconds.ShouldBe(2.5);
        facts.AppFolderChecked.ShouldBeTrue();
        facts.AppSawFile.ShouldBeTrue();
        facts.SizeMb.ShouldBe(3.0);
        facts.AppRenamed.ShouldBeTrue();
        facts.AppDeleted.ShouldBeTrue();
        facts.AppFileGone.ShouldBeTrue();
        facts.ErrorType.ShouldBeNull();
        Directory.EnumerateFileSystemEntries(_appFolder).ShouldBeEmpty();
        call.Connection.ShouldBe(FakeConnectionString);
        call.Folder.ShouldBe(FakeSqlFolder);
        call.File.ShouldBe(ExpectedFileName);
        call.Timeout.ShouldBe(TimeSpan.FromSeconds(120));
    }

    [Fact]
    public async Task ARunnerAnswering262GivesWrittenFalseWithTheNumberAndNoAppChecks()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(false, null, false, [262], TimeSpan.FromSeconds(0.2)));

        var facts = await BackupCheck.RunAsync(Settings(_appFolder), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeFalse();
        facts.SqlErrorNumbers.ShouldBe([262]);
        facts.AppFolderChecked.ShouldBeFalse();
        facts.AppSawFile.ShouldBeFalse();
        facts.AppRenamed.ShouldBeFalse();
        facts.AppDeleted.ShouldBeFalse();
    }

    [Fact]
    public async Task ATimedOutRunReportsTimedOut()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(false, null, true, [-2], TimeSpan.FromSeconds(120)));

        var facts = await BackupCheck.RunAsync(Settings(null), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.TimedOut.ShouldBeTrue();
        facts.Written.ShouldBeFalse();
        facts.Seconds.ShouldBe(120);
    }

    [Fact]
    public async Task ARefusedValueIsReportedByKind()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(false, "folder", false, [], TimeSpan.Zero));

        var facts = await BackupCheck.RunAsync(Settings(null), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeFalse();
        facts.Refused.ShouldBe("folder");
    }

    [Fact]
    public async Task WithTheAppFolderUnsetNoAppSideCheckRuns()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(true, null, false, [], TimeSpan.FromSeconds(1)));

        var facts = await BackupCheck.RunAsync(Settings(null), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeTrue();
        facts.AppFolderChecked.ShouldBeFalse();
        facts.AppFolderInsideContentRoot.ShouldBeNull();
    }

    [Fact]
    public async Task AWrittenFileTheAppCannotSeeIsReportedAsNotSeen()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(true, null, false, [], TimeSpan.FromSeconds(1)));

        var facts = await BackupCheck.RunAsync(Settings(_appFolder), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeTrue();
        facts.AppFolderChecked.ShouldBeTrue();
        facts.AppSawFile.ShouldBeFalse();
        facts.AppRenamed.ShouldBeFalse();
        facts.AppDeleted.ShouldBeFalse();
    }

    [Fact]
    public async Task MissingSettingsAreListedByNameAndTheRunnerIsNotCalled()
    {
        var called = false;
        BackupRunner runner = (_, _, _, _, _, _) =>
        {
            called = true;
            return Task.FromResult(new BackupStatementOutcome(true, null, false, [], TimeSpan.Zero));
        };

        var facts = await BackupCheck.RunAsync(new BackupSettings(null, "  ", null), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        called.ShouldBeFalse();
        facts.Written.ShouldBeFalse();
        facts.MissingSettings.ShouldBe(["HostProbe:Backup:ConnectionString", "HostProbe:Backup:SqlServerFolder"]);
    }

    [Fact]
    public async Task ARunnerThatThrowsGivesTheTypeNameOnlyAndNoValueReachesTheFacts()
    {
        BackupRunner runner = (connection, folder, _, _, _, _) =>
            throw new InvalidOperationException($"failed for {connection} in {folder} on csps_fake_db");

        var facts = await BackupCheck.RunAsync(Settings(_appFolder), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        facts.Written.ShouldBeFalse();
        facts.ErrorType.ShouldBe(nameof(InvalidOperationException));
        var json = JsonSerializer.Serialize(facts, JsonSerializerOptions.Web);
        json.ShouldNotContain("probe.test.invalid");
        json.ShouldNotContain("csps_fake_db");
        json.ShouldNotContain("fake");
        json.ShouldNotContain("sqlfolder");
        json.ShouldNotContain(_appFolder.Replace("\\", "\\\\", StringComparison.Ordinal));
        json.ShouldNotContain("csps-backup-test-");
    }

    [Fact]
    public async Task TheAppFolderIsReportedAsInsideOrOutsideTheContentRoot()
    {
        BackupRunner runner = (_, _, _, _, _, _) =>
            Task.FromResult(new BackupStatementOutcome(false, null, false, [3201], TimeSpan.Zero));
        var inside = Path.Combine(_contentRoot, "www", "db");

        var insideFacts = await BackupCheck.RunAsync(Settings(inside), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);
        var outsideFacts = await BackupCheck.RunAsync(Settings(_appFolder), _contentRoot, runner, _clock, TestContext.Current.CancellationToken);

        insideFacts.AppFolderInsideContentRoot.ShouldBe(true);
        outsideFacts.AppFolderInsideContentRoot.ShouldBe(false);
    }

    [Fact]
    public void TheSettingsComeFromTheThreeBackupKeys()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["HostProbe:Backup:ConnectionString"] = "a",
                ["HostProbe:Backup:SqlServerFolder"] = "b",
                ["HostProbe:Backup:AppFolder"] = "c",
            })
            .Build();

        BackupSettings.From(configuration).ShouldBe(new BackupSettings("a", "b", "c"));
    }

    [Theory]
    [InlineData(null, "x", StatusCodes.Status503ServiceUnavailable)]
    [InlineData("short", "short", StatusCodes.Status503ServiceUnavailable)]
    public void NoUsableKeyClosesTheProbeWith503(string? configured, string provided, int expected) =>
        ProbeKey.DeniedStatusCode(provided, configured).ShouldBe(expected);

    [Fact]
    public void AWrongOrMissingKeyGives401AndTheRightKeyIsLetThrough()
    {
        var key = new string('k', ProbeKey.MinimumLength);

        ProbeKey.DeniedStatusCode("wrong", key).ShouldBe(StatusCodes.Status401Unauthorized);
        ProbeKey.DeniedStatusCode(null, key).ShouldBe(StatusCodes.Status401Unauthorized);
        ProbeKey.DeniedStatusCode(key, key).ShouldBeNull();
    }

    private static BackupSettings Settings(string? appFolder) => new(FakeConnectionString, FakeSqlFolder, appFolder);

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class Recorder
    {
        public string? Connection { get; private set; }

        public string? Folder { get; private set; }

        public string? File { get; private set; }

        public TimeSpan Timeout { get; private set; }

        public void Record(string connection, string folder, string file, TimeSpan timeout)
        {
            Connection = connection;
            Folder = folder;
            File = file;
            Timeout = timeout;
        }
    }
}
