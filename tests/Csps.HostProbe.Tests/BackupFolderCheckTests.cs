using Csps.Infrastructure.Maintenance;

namespace Csps.HostProbe.Tests;

/// <summary>D-49: the probe asks the SQL server for its own default backup folder, read-only, with the site's login.</summary>
public sealed class BackupFolderCheckTests
{
    private const string FakeConnectionString = "Server=probe.test.invalid;Database=csps_fake_db;Integrated Security=true";
    private const string FakeFolder = """X:\fake\backup-default""";

    [Fact]
    public async Task TheServersFolderIsReportedAsItAnswered()
    {
        string? usedConnection = null;
        DefaultBackupFolderReader reader = (connection, timeout, token) =>
        {
            usedConnection = connection;
            return Task.FromResult(new DefaultBackupFolderOutcome(FakeFolder, []));
        };

        var facts = await BackupFolderCheck.RunAsync(Settings(FakeConnectionString), reader, TestContext.Current.CancellationToken);

        facts.DefaultBackupFolder.ShouldBe(FakeFolder);
        facts.SqlErrorNumbers.ShouldBeEmpty();
        facts.MissingSettings.ShouldBeEmpty();
        facts.ErrorType.ShouldBeNull();
        usedConnection.ShouldBe(FakeConnectionString);
    }

    [Fact]
    public async Task ASqlErrorGivesTheNumbersAndNoFolder()
    {
        DefaultBackupFolderReader reader = (_, _, _) => Task.FromResult(new DefaultBackupFolderOutcome(null, [229]));

        var facts = await BackupFolderCheck.RunAsync(Settings(FakeConnectionString), reader, TestContext.Current.CancellationToken);

        facts.DefaultBackupFolder.ShouldBeNull();
        facts.SqlErrorNumbers.ShouldBe([229]);
    }

    [Fact]
    public async Task AMissingConnectionStringIsListedAndTheServerIsNotAsked()
    {
        var called = false;
        DefaultBackupFolderReader reader = (_, _, _) =>
        {
            called = true;
            return Task.FromResult(new DefaultBackupFolderOutcome(FakeFolder, []));
        };

        var facts = await BackupFolderCheck.RunAsync(Settings(null), reader, TestContext.Current.CancellationToken);

        called.ShouldBeFalse();
        facts.MissingSettings.ShouldBe([BackupSettings.ConnectionStringKey]);
        facts.DefaultBackupFolder.ShouldBeNull();
    }

    [Fact]
    public async Task AReaderThatThrowsGivesTheTypeNameOnly()
    {
        DefaultBackupFolderReader reader = (_, _, _) => throw new InvalidOperationException("secret " + FakeConnectionString);

        var facts = await BackupFolderCheck.RunAsync(Settings(FakeConnectionString), reader, TestContext.Current.CancellationToken);

        facts.ErrorType.ShouldBe(nameof(InvalidOperationException));
        facts.DefaultBackupFolder.ShouldBeNull();
        System.Text.Json.JsonSerializer.Serialize(facts).ShouldNotContain("secret");
    }

    // The folder setting is not needed for this question.
    private static BackupSettings Settings(string? connectionString) => new(connectionString, null, null);
}
