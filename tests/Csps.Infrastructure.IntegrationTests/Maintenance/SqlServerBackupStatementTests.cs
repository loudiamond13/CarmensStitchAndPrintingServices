using System.Transactions;
using Csps.Infrastructure.Maintenance;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>D-40, D-42: the one approved backup statement writes a COPY_ONLY backup, refuses unsafe names and reports facts only.</summary>
public sealed class SqlServerBackupStatementTests : IDisposable
{
    private const string TestFolderPrefix = "csps-backup-test-";
    private const string ContainerFolder = "/var/opt/mssql/data";
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(60);

    private readonly string _localFolder = Path.Combine(Path.GetTempPath(), TestFolderPrefix + Guid.NewGuid().ToString("N"));
    private readonly string _fileName = "csps-backup-" + Guid.NewGuid().ToString("N") + ".bak.part";

    public SqlServerBackupStatementTests() => Directory.CreateDirectory(_localFolder);

    public void Dispose()
    {
        if (Directory.Exists(_localFolder))
        {
            Directory.Delete(_localFolder, recursive: true);
        }
    }

    [Fact]
    public async Task ItWritesACopyOnlyBackupIntoTheFolder()
    {
        var instance = await SqlServerInstance.GetSharedAsync();
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var outcome = await SqlServerBackupStatement.RunAsync(
                database.ConnectionString, FolderFor(instance), _fileName, Budget, TimeProvider.System, TestContext.Current.CancellationToken);

            outcome.Written.ShouldBeTrue();
            outcome.Refused.ShouldBeNull();
            outcome.TimedOut.ShouldBeFalse();
            outcome.SqlErrorNumbers.ShouldBeEmpty();
            if (instance.Backend == SqlBackend.LocalDb)
            {
                new FileInfo(Path.Combine(_localFolder, _fileName)).Length.ShouldBeGreaterThan(0);
            }
        }
    }

    [Fact]
    public async Task AFolderThatDoesNotExistOnTheServerGivesErrorNumber3201AndThrowsNothing()
    {
        var instance = await SqlServerInstance.GetSharedAsync();
        var missing = instance.Backend == SqlBackend.LocalDb
            ? Path.Combine(_localFolder, "no-such-folder")
            : ContainerFolder + "/csps-no-such-folder";
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var outcome = await SqlServerBackupStatement.RunAsync(
                database.ConnectionString, missing, _fileName, Budget, TimeProvider.System, TestContext.Current.CancellationToken);

            outcome.Written.ShouldBeFalse();
            outcome.SqlErrorNumbers.ShouldContain(3201);
        }
    }

    [Fact]
    public async Task ItSucceedsWithAnAmbientTransactionBecauseTheConnectionNeverEnlists()
    {
        var instance = await SqlServerInstance.GetSharedAsync();
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            using var scope = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

            var outcome = await SqlServerBackupStatement.RunAsync(
                database.ConnectionString, FolderFor(instance), _fileName, Budget, TimeProvider.System, TestContext.Current.CancellationToken);

            outcome.Written.ShouldBeTrue();
            outcome.SqlErrorNumbers.ShouldBeEmpty();
        }
    }

    [Theory]
    [InlineData("""C:\csps\db""")]
    [InlineData("C:/csps/db")]
    [InlineData("""C:\csps\db\""")]
    [InlineData("""\\sql01.test.invalid\share\db""")]
    [InlineData("/var/opt/mssql/data")]
    [InlineData("""D:\My Folder\a_b-c.d""")]
    public void IsSafeFolderAcceptsDriveUncAndPosixAbsolutePaths(string folder) =>
        SqlServerBackupStatement.IsSafeFolder(folder).ShouldBeTrue();

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("""relative\path""")]
    [InlineData("db")]
    [InlineData("C:")]
    [InlineData("..")]
    [InlineData("""C:\a\..\b""")]
    [InlineData("/var/../etc")]
    [InlineData("""C:\a\.\b""")]
    [InlineData("C:\\a'b")]
    [InlineData("C:\\a;b")]
    [InlineData("C:\\a]b")]
    [InlineData("C:\\a[b")]
    [InlineData("C:\\a\"b")]
    [InlineData("C:\\a%b")]
    [InlineData("C:\\a\u0001b")]
    [InlineData("C:\\a\nb")]
    [InlineData("C:\\a\u00e9b")]
    public void IsSafeFolderRefusesRelativeTraversingAndUnsafePaths(string folder) =>
        SqlServerBackupStatement.IsSafeFolder(folder).ShouldBeFalse();

    [Fact]
    public void IsSafeFolderRefusesAPathOver200Characters()
    {
        SqlServerBackupStatement.IsSafeFolder("C:\\" + new string('a', 197)).ShouldBeTrue();
        SqlServerBackupStatement.IsSafeFolder("C:\\" + new string('a', 198)).ShouldBeFalse();
    }

    [Theory]
    [InlineData("csps-probe-20261102-191700.bak.part")]
    [InlineData("csps-backup-20261102-1917.bak")]
    [InlineData("a.bak")]
    public void IsSafeFileNameAcceptsLowerCaseLettersDigitsAndHyphens(string name) =>
        SqlServerBackupStatement.IsSafeFileName(name).ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(".bak")]
    [InlineData("Upper.bak")]
    [InlineData("a.txt")]
    [InlineData("a.bak.part.bak")]
    [InlineData("a b.bak")]
    [InlineData("a_b.bak")]
    [InlineData("a/b.bak")]
    [InlineData("""..\x.bak""")]
    [InlineData("a.bak\n")]
    [InlineData("a.bak.part ")]
    public void IsSafeFileNameRefusesAnythingElse(string? name) =>
        SqlServerBackupStatement.IsSafeFileName(name).ShouldBeFalse();

    [Theory]
    [InlineData("a")]
    [InlineData("CSPS_Test_0f8fad5b-d9cb-469f-a165-70867728950e")]
    [InlineData("Csps-Prod_1")]
    public void IsSafeDatabaseNameAcceptsLettersDigitsUnderscoreAndHyphen(string name) =>
        SqlServerBackupStatement.IsSafeDatabaseName(name).ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("a b")]
    [InlineData("a]b")]
    [InlineData("a;b")]
    [InlineData("a.b")]
    [InlineData("a'b")]
    public void IsSafeDatabaseNameRefusesAnythingElse(string? name) =>
        SqlServerBackupStatement.IsSafeDatabaseName(name).ShouldBeFalse();

    [Fact]
    public void IsSafeDatabaseNameChecksTheLengthLimit()
    {
        SqlServerBackupStatement.IsSafeDatabaseName(new string('a', 128)).ShouldBeTrue();
        SqlServerBackupStatement.IsSafeDatabaseName(new string('a', 129)).ShouldBeFalse();
    }

    [Theory]
    [InlineData("folder", "C:\\a'b", "csps-x.bak", "csps_x")]
    [InlineData("file", """C:\csps\db""", "Bad Name.bak", "csps_x")]
    [InlineData("database", """C:\csps\db""", "csps-x.bak", "bad]name")]
    [InlineData("database", """C:\csps\db""", "csps-x.bak", "bad name")]
    [InlineData("database", """C:\csps\db""", "csps-x.bak", "")]
    public async Task ARefusedValueGivesRefusedAndOpensNoConnection(string refused, string folder, string file, string databaseName)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = "probe.test.invalid",
            IntegratedSecurity = true,
            InitialCatalog = databaseName,
            ConnectTimeout = 1,
        };

        var started = TimeProvider.System.GetTimestamp();
        var outcome = await SqlServerBackupStatement.RunAsync(
            builder.ConnectionString, folder, file, Budget, TimeProvider.System, TestContext.Current.CancellationToken);

        outcome.Written.ShouldBeFalse();
        outcome.Refused.ShouldBe(refused);
        outcome.TimedOut.ShouldBeFalse();
        outcome.SqlErrorNumbers.ShouldBeEmpty();
        TimeProvider.System.GetElapsedTime(started).ShouldBeLessThan(TimeSpan.FromSeconds(1));
    }

    private string FolderFor(SqlServerInstance instance) => instance.Backend == SqlBackend.LocalDb ? _localFolder : ContainerFolder;
}
