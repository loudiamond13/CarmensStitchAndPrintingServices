using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// CONT-01, D-21, OR-7: the AddOpeningHours migration creates the table with seven closed rows (Monday 1 to Sunday 7), guards the rows
/// with CHECK constraints instead of triggers, and never invents business hours.
/// </summary>
public sealed class OpeningHoursMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Before = "20261112030543_AddSiteContactDetails";

    [Fact]
    public async Task AFreshDatabaseHasSevenClosedRowsKeyedOneToSeven()
    {
        await using var context = database.CreateContext();

        var rows = await context.OpeningHours.AsNoTracking().OrderBy(row => row.DayOfWeek).ToListAsync(TestContext.Current.CancellationToken);

        rows.Select(row => row.DayOfWeek).ShouldBe([1, 2, 3, 4, 5, 6, 7]);
        rows.ShouldAllBe(row => row.OpensAt == null && row.ClosesAt == null);
        rows.ShouldAllBe(row => row.UpdatedAtUtc == null && row.UpdatedById == null && row.CreatedById == null);
    }

    [Fact]
    public async Task TheTimesAreWholeSecondTimeColumns()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.OpeningHours') AND name IN (N'OpensAt', N'ClosesAt') AND system_type_id = 41 AND scale = 0"))
            .ShouldBe(2);
    }

    [Fact]
    public async Task AnOpeningTimeWithNoClosingTimeFailsTheBothOrNoneCheck()
    {
        var failure = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("UPDATE dbo.OpeningHours SET OpensAt = '09:00:00' WHERE DayOfWeek = 1"));

        failure.Message.ShouldContain("CK_OpeningHours_BothOrNone");
    }

    [Fact]
    public async Task AClosingTimeWithNoOpeningTimeFailsTheBothOrNoneCheck()
    {
        var failure = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("UPDATE dbo.OpeningHours SET ClosesAt = '18:00:00' WHERE DayOfWeek = 2"));

        failure.Message.ShouldContain("CK_OpeningHours_BothOrNone");
    }

    [Theory]
    [InlineData("18:00:00", "09:00:00")]
    [InlineData("09:00:00", "09:00:00")]
    public async Task AClosingTimeNotAfterTheOpeningTimeFailsTheClosesAfterOpensCheck(string opens, string closes)
    {
        var failure = await Should.ThrowAsync<SqlException>(
            () => ExecuteAsync($"UPDATE dbo.OpeningHours SET OpensAt = '{opens}', ClosesAt = '{closes}' WHERE DayOfWeek = 3"));

        failure.Message.ShouldContain("CK_OpeningHours_ClosesAfterOpens");
    }

    [Fact]
    public async Task AnEighthDayCannotBeAdded()
    {
        var failure = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("INSERT INTO dbo.OpeningHours (DayOfWeek, CreatedAtUtc) VALUES (8, SYSDATETIMEOFFSET())"));

        failure.Message.ShouldContain("CK_OpeningHours_Day");
    }

    [Fact]
    public async Task TheMigrationAddsNoTriggerAndTheTableHasNoForeignKey()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.OpeningHours')")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.OpeningHours')")).ShouldBe(0);
    }

    [Fact]
    public async Task TheReviewedScriptCreatesTheTableAndTheSevenClosedRowsAndHoldsNoTriggerOrDrop()
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

            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.OpeningHours WHERE OpensAt IS NULL AND ClosesAt IS NULL")).ShouldBe(7);
            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.OpeningHours")).ShouldBe(7);
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheHours()
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
                return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
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
