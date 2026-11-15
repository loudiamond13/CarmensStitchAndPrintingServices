using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// D-26, D-39, OR-7: the AddSharePicture migration adds five nullable columns to SiteSettings and nothing else. It changes no existing
/// value, adds no trigger and drops nothing, the seed row ends up with nulls, and it refuses to be undone.
/// </summary>
public sealed partial class SharePictureMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] NewColumns = ["SharePicturePublicId", "SharePictureWidth", "SharePictureHeight", "SharePictureBytes", "SharePictureFormat"];

    [Fact]
    public async Task TheFiveShareColumnsExistWithTheirTypesAreNullableAndTheSeedRowHoldsNulls()
    {
        var columns = await ReadColumnsAsync(database.ConnectionString);

        columns["SharePicturePublicId"].ShouldBe(new Column("nvarchar", 200, true));
        columns["SharePictureWidth"].ShouldBe(new Column("int", null, true));
        columns["SharePictureHeight"].ShouldBe(new Column("int", null, true));
        columns["SharePictureBytes"].ShouldBe(new Column("int", null, true));
        columns["SharePictureFormat"].ShouldBe(new Column("varchar", 8, true));
        (await ScalarAsync(
            database.ConnectionString,
            "SELECT COUNT(*) FROM dbo.SiteSettings WHERE Id = 1 AND SharePicturePublicId IS NULL AND SharePictureWidth IS NULL AND SharePictureHeight IS NULL AND SharePictureBytes IS NULL AND SharePictureFormat IS NULL")).ShouldBe(1);
        (await ScalarAsync(database.ConnectionString, "SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.SiteSettings')")).ShouldBe(0);
    }

    [Fact]
    public async Task TheIdempotentScriptOnlyAddsTheFiveColumnsKeepsEveryOldValueAndRunsTwice()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_AddSharePicture", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                var before = all[index - 1];
                await migrator.MigrateAsync(before, TestContext.Current.CancellationToken);
                var oldTagline = await ScalarTextAsync(empty.ConnectionString, "SELECT Tagline FROM dbo.SiteSettings WHERE Id = 1");
                var script = migrator.GenerateScript(fromMigration: before, toMigration: all[index], options: MigrationsSqlGenerationOptions.Idempotent);

                foreach (var column in NewColumns)
                {
                    script.ShouldContain($"ALTER TABLE [SiteSettings] ADD [{column}]");
                }

                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
                DropOrDelete().IsMatch(script).ShouldBeFalse("nothing is dropped or deleted");
                await ApplyAsync(empty.ConnectionString, script);
                await ApplyAsync(empty.ConnectionString, script);

                (await ScalarTextAsync(empty.ConnectionString, "SELECT Tagline FROM dbo.SiteSettings WHERE Id = 1")).ShouldBe(oldTagline);
                var columnsAfter = await ReadColumnsAsync(empty.ConnectionString);
                NewColumns.ShouldAllBe(column => columnsAfter.ContainsKey(column));
            }
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheStoredPictureRecord()
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
                var before = all[all.FindIndex(id => id.EndsWith("_AddSharePicture", StringComparison.Ordinal)) - 1];

                await Should.ThrowAsync<NotSupportedException>(() => migrator.MigrateAsync(before, TestContext.Current.CancellationToken));
            }
        }
    }

    private sealed record Column(string Type, int? Length, bool Nullable);

    private static async Task<Dictionary<string, Column>> ReadColumnsAsync(string connectionString)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'SiteSettings';";
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    var columns = new Dictionary<string, Column>(StringComparer.Ordinal);
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        columns[reader.GetString(0)] = new Column(
                            reader.GetString(1),
                            reader.IsDBNull(2) ? null : reader.GetInt32(2),
                            string.Equals(reader.GetString(3), "YES", StringComparison.Ordinal));
                    }

                    return columns;
                }
            }
        }
    }

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
                return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static async Task<string> ScalarTextAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return (string)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static async Task ApplyAsync(string connectionString, string script)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
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
    }

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex GoSeparator();

    [GeneratedRegex(@"\b(DROP|DELETE\s+FROM)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DropOrDelete();
}
