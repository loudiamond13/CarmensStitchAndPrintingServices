using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// D-P11-BL-35, FND-12, OR-1: a database built from the migrations has READ_COMMITTED_SNAPSHOT on, so a read no longer waits for another
/// transaction's unfinished write. The production script turns it on in its own batch for the current database only, and a second run changes nothing.
/// </summary>
public sealed partial class ReadCommittedSnapshotMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Changed = new(2026, 11, 13, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AMigratedDatabaseHasReadCommittedSnapshotOn()
    {
        (await IsOnAsync(database.DatabaseName)).ShouldBeTrue();
    }

    [Fact]
    public async Task TwoTransactionsThatEachChangedOneRowReadTheOtherRowWithoutADeadlock()
    {
        const string firstLock = "account-token:62";
        const string secondLock = "account-token:63";
        await using var one = database.CreateContext();
        await using var two = database.CreateContext();
        var firstBefore = await ReadAsync(one, firstLock);
        var secondBefore = await ReadAsync(one, secondLock);
        var first = await one.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var second = await two.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (first)
        await using (second)
        {
            await TouchAsync(one, firstLock);
            await TouchAsync(two, secondLock);

            var outcomes = await Task.WhenAll(CaptureAsync(() => ReadAsync(one, secondLock)), CaptureAsync(() => ReadAsync(two, firstLock)))
                .WaitAsync(TimeSpan.FromSeconds(60), TestContext.Current.CancellationToken);

            outcomes[0].Error.ShouldBeNull($"the first transaction's read ended with: {outcomes[0].Error}");
            outcomes[1].Error.ShouldBeNull($"the second transaction's read ended with: {outcomes[1].Error}");
            outcomes[0].Value.ShouldBe(secondBefore);
            outcomes[1].Value.ShouldBe(firstBefore);
        }

        static Task TouchAsync(CspsDbContext context, string lockName) =>
            context.Set<DatabaseLock>().Where(row => row.Name == lockName)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, Changed), TestContext.Current.CancellationToken);

        static async Task<(DateTimeOffset? Value, Exception? Error)> CaptureAsync(Func<Task<DateTimeOffset?>> work)
        {
            try
            {
                return (await work(), null);
            }
            catch (Exception error) when (error is InvalidOperationException or SqlException)
            {
                return (null, error);
            }
        }
    }

    [Fact]
    public async Task TheProductionScriptTurnsItOnInItsOwnBatchForTheCurrentDatabaseOnlyAndRunsTwice()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_TurnOnReadCommittedSnapshot", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                var before = all[index - 1];
                await migrator.MigrateAsync(before, TestContext.Current.CancellationToken);
                (await IsOnAsync(empty.DatabaseName)).ShouldBeFalse();
                var script = migrator.GenerateScript(fromMigration: before, toMigration: all[index], options: MigrationsSqlGenerationOptions.Idempotent);

                var turnOn = GoSeparator().Split(script).Where(batch => SnapshotOn().IsMatch(batch)).ToList();
                turnOn.Count.ShouldBe(1);
                turnOn[0].ShouldContain("__EFMigrationsHistory");
                turnOn[0].ShouldContain(all[index]);
                turnOn[0].ShouldNotContain("BEGIN TRANSACTION", Case.Insensitive);
                OtherThanCurrent().IsMatch(script).ShouldBeFalse("every ALTER DATABASE must name CURRENT");
                script.ShouldNotContain("DROP", Case.Insensitive);
                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);

                var connection = new SqlConnection(empty.ConnectionString);
                await using (connection)
                {
                    await connection.OpenAsync(TestContext.Current.CancellationToken);
                    await ApplyScriptAsync(connection, script);
                    await ApplyScriptAsync(connection, script);
                    (await HistoryCountAsync(connection, all[index])).ShouldBe(1);
                }

                (await IsOnAsync(empty.DatabaseName)).ShouldBeTrue();
            }
        }
    }

    [Fact]
    public async Task UndoingTheMigrationTurnsItOffAndApplyingItAgainTurnsItOn()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_TurnOnReadCommittedSnapshot", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);

                await migrator.MigrateAsync(all[index], TestContext.Current.CancellationToken);
                (await IsOnAsync(empty.DatabaseName)).ShouldBeTrue();

                await migrator.MigrateAsync(all[index - 1], TestContext.Current.CancellationToken);
                (await IsOnAsync(empty.DatabaseName)).ShouldBeFalse();

                await migrator.MigrateAsync(all[index], TestContext.Current.CancellationToken);
                (await IsOnAsync(empty.DatabaseName)).ShouldBeTrue();
            }
        }
    }

    private static Task<DateTimeOffset?> ReadAsync(CspsDbContext context, string lockName) =>
        context.Set<DatabaseLock>().AsNoTracking().Where(row => row.Name == lockName).Select(row => row.TakenAtUtc)
            .SingleAsync(TestContext.Current.CancellationToken);

    // Read from master so the check never touches a pooled connection to the database the migration just changed.
    private static async Task<bool> IsOnAsync(string databaseName)
    {
        var connection = new SqlConnection((await SqlServerInstance.GetSharedAsync()).MasterConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = "SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = @name;";
                command.Parameters.Add(new SqlParameter("@name", databaseName));
                return (bool)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static async Task<int> HistoryCountAsync(SqlConnection connection, string migrationId)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = "SELECT COUNT(*) FROM dbo.__EFMigrationsHistory WHERE MigrationId = @id;";
            command.Parameters.Add(new SqlParameter("@id", migrationId));
            return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        }
    }

    private static async Task ApplyScriptAsync(SqlConnection connection, string script)
    {
        foreach (var batch in GoSeparator().Split(script).Where(static batch => !string.IsNullOrWhiteSpace(batch)))
        {
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = batch;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex GoSeparator();

    [GeneratedRegex(@"SET\s+READ_COMMITTED_SNAPSHOT\s+ON", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SnapshotOn();

    [GeneratedRegex(@"ALTER\s+DATABASE\s+(?!CURRENT\b)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex OtherThanCurrent();
}
