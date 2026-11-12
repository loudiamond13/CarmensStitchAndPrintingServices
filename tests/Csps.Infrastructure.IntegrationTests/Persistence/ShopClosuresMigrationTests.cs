using System.Globalization;
using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// CONT-04, D-21, OR-7: the AddShopClosures migration creates the closures table with CHECK constraints instead of triggers, adds the
/// standing site-content lock row, changes no existing table and refuses to be undone.
/// </summary>
public sealed class ShopClosuresMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Before = "20261112073000_AddOpeningHours";

    [Fact]
    public async Task AFreshDatabaseHasAnEmptyClosuresTableWithDateColumnsAndANoteOfEightyCharacters()
    {
        await database.ResetAsync();

        (await ScalarAsync("SELECT COUNT(*) FROM dbo.ShopClosures")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ShopClosures') AND name IN (N'FirstDay', N'LastDay') AND system_type_id = 40 AND is_nullable = 0")).ShouldBe(2);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ShopClosures') AND name = N'Note' AND max_length = 160 AND is_nullable = 1")).ShouldBe(1);
    }

    [Fact]
    public async Task ALastDayBeforeTheFirstDayFailsTheLastOnOrAfterFirstCheck()
    {
        var failure = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(Insert("2026-12-25", "2026-12-24")));

        failure.Message.ShouldContain("CK_ShopClosures_LastOnOrAfterFirst");
    }

    [Fact]
    public async Task AThirtyTwoDayClosureFailsTheSpanCheckAndAThirtyOneDayClosurePasses()
    {
        await database.ResetAsync();

        await ExecuteAsync(Insert("2026-12-01", "2026-12-31"));
        var failure = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(Insert("2027-02-01", "2027-03-04")));

        failure.Message.ShouldContain("CK_ShopClosures_Span");
        await database.ResetAsync();
    }

    [Fact]
    public async Task TheStandingSiteContentLockRowExistsAndTheTableHasNoTriggerOrForeignKey()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.DatabaseLocks WHERE Name = N'site-content'")).ShouldBe(1);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.ShopClosures')")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ShopClosures')")).ShouldBe(0);
    }

    [Fact]
    public async Task TheLastDayHasAnIndexForTheUpcomingList() =>
        (await ScalarAsync("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ShopClosures') AND name = N'IX_ShopClosures_LastDay'")).ShouldBe(1);

    [Fact]
    public async Task TheReviewedScriptCreatesTheTableAndTheLockRowAndHoldsNoTriggerOrDrop()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(Before, TestContext.Current.CancellationToken);
                var script = migrator.GenerateScript(fromMigration: Before, options: MigrationsSqlGenerationOptions.Idempotent);

                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
                script.ShouldNotContain("DROP TABLE", Case.Insensitive);
                await ApplyAsync(empty.ConnectionString, script);
            }

            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.ShopClosures")).ShouldBe(0);
            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.DatabaseLocks WHERE Name = N'site-content'")).ShouldBe(1);
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheClosures()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);

                await Should.ThrowAsync<NotSupportedException>(() => migrator.MigrateAsync(Before, TestContext.Current.CancellationToken));
            }
        }
    }

    private static string Insert(string first, string last) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.ShopClosures (Id, FirstDay, LastDay, CreatedAtUtc) VALUES (NEWID(), '{first}', '{last}', SYSDATETIMEOFFSET())");

    private Task<int> ScalarAsync(string sql) => ScalarAsync(database.ConnectionString, sql);

    private static async Task<int> ScalarAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), CultureInfo.InvariantCulture);
            }
        }
    }

    private Task ExecuteAsync(string sql) => ApplyAsync(database.ConnectionString, sql);

    private static async Task ApplyAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            foreach (var batch in Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.CultureInvariant))
            {
                if (string.IsNullOrWhiteSpace(batch))
                {
                    continue;
                }

                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = batch;
                    await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
                }
            }
        }
    }
}
