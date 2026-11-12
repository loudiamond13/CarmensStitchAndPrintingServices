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
/// CONT-03, D-05, OR-7: the AddTestimonials migration creates one table with a CHECK constraint on the stars instead of a trigger, inserts
/// no row, touches no other table and refuses to be undone. Tests that add rows take them out again.
/// </summary>
public sealed class TestimonialsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task StarsCheckRejectsZeroAndSixAndAcceptsOneAndFive()
    {
        var zero = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(Insert("Zero", 0)));
        var six = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(Insert("Six", 6)));

        zero.Message.ShouldContain("CK_Testimonials_Stars");
        six.Message.ShouldContain("CK_Testimonials_Stars");
        try
        {
            await ExecuteAsync(Insert("One", 1));
            await ExecuteAsync(Insert("Five", 5));
            (await ScalarAsync("SELECT COUNT(*) FROM dbo.Testimonials WHERE Name IN (N'One', N'Five')")).ShouldBe(2);
        }
        finally
        {
            await ExecuteAsync("DELETE FROM dbo.Testimonials WHERE Name IN (N'One', N'Five')");
        }
    }

    [Fact]
    public async Task TheTableHasNoTriggerAndNoSeededRow()
    {
        await database.ResetAsync();

        (await ScalarAsync("SELECT COUNT(*) FROM sys.tables WHERE name = N'Testimonials'")).ShouldBe(1);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.Testimonials')")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.Testimonials")).ShouldBe(0);
    }

    [Fact]
    public async Task TheTableHasNoJsonColumnAndTheTextColumnsAreUnicodeAndSizedToTheRules()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID(N'dbo.Testimonials') AND t.name = N'json'")).ShouldBe(0);
        (await ScalarAsync("SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Testimonials') AND name = N'Quote'")).ShouldBe(600);
        (await ScalarAsync("SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Testimonials') AND name = N'Name'")).ShouldBe(120);
        (await ScalarAsync("SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Testimonials') AND name = N'TeamOrRole'")).ShouldBe(160);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Testimonials') AND name = N'TeamOrRole' AND is_nullable = 1")).ShouldBe(1);
    }

    [Fact]
    public async Task TheIdempotentScriptOnlyCreatesTheTableAndItsIndexAndRunsTwice()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_AddTestimonials", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                var before = all[index - 1];
                await migrator.MigrateAsync(before, TestContext.Current.CancellationToken);
                var script = migrator.GenerateScript(fromMigration: before, toMigration: all[index], options: MigrationsSqlGenerationOptions.Idempotent);

                script.ShouldContain(all[index]);
                script.ShouldContain("CREATE TABLE [Testimonials]");
                script.ShouldContain("CK_Testimonials_Stars");
                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
                script.ShouldNotContain("DROP ", Case.Insensitive);
                script.ShouldNotContain("INSERT INTO [Testimonials]", Case.Insensitive);
                script.ShouldNotContain("ALTER TABLE", Case.Insensitive);
                await ApplyAsync(empty.ConnectionString, script);
                await ApplyAsync(empty.ConnectionString, script);
            }

            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.Testimonials")).ShouldBe(0);
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheTestimonials()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);
                var all = context.Database.GetMigrations().ToList();
                var before = all[all.FindIndex(id => id.EndsWith("_AddTestimonials", StringComparison.Ordinal)) - 1];

                await Should.ThrowAsync<NotSupportedException>(() => migrator.MigrateAsync(before, TestContext.Current.CancellationToken));
            }
        }
    }

    private static string Insert(string name, int stars) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.Testimonials (Id, Quote, Name, TeamOrRole, Stars, Position, IsShown, CreatedAtUtc) VALUES (NEWID(), N'Sample quote', N'{name}', NULL, {stars}, 99, 1, SYSDATETIMEOFFSET())");

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
