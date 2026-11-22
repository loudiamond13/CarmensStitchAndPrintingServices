using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// ANL-06, OR-7, PRD 5.4: the AddDailyPageCounts migration makes the DailyPageCounts table with a date, a page key and a count, the pair of day and
/// page as the primary key, no row version, no JSON column, no trigger and no foreign key, and the test reset empties it.
/// </summary>
public sealed class DailyPageCountsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] ExpectedColumns =
    [
        ("BusinessDay", "date", 3, false),
        ("PageKey", "varchar", 32, false),
        ("Views", "int", 4, false),
    ];

    [Fact]
    public async Task TheTableHasExactlyTheThreeColumnsWithTheirTypesLengthsAndNullability()
    {
        var columns = new List<(string Name, string Type, int MaxLength, bool Nullable)>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.DailyPageCounts') ORDER BY c.column_id;",
            reader => columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt16(2), reader.GetBoolean(3))));

        columns.ShouldBe(ExpectedColumns);
    }

    [Fact]
    public async Task TheDayAndThePageKeyTogetherAreThePrimaryKey()
    {
        var primary = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.DailyPageCounts') AND i.is_primary_key = 1 ORDER BY ic.key_ordinal;",
            reader => primary.Add(reader.GetString(0)));

        primary.ShouldBe(["BusinessDay", "PageKey"]);
    }

    [Fact]
    public async Task TheTableHasNoJsonColumnNoRowVersionNoTriggerAndNoForeignKey()
    {
        var jsonOrRowVersionColumns = 0;
        var triggers = 0;
        var foreignKeys = 0;

        // A rowversion column is listed as "timestamp" in sys.types.
        await ReadAsync(
            "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.DailyPageCounts') AND t.name IN (N'json', N'timestamp');",
            reader => jsonOrRowVersionColumns = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.DailyPageCounts');", reader => triggers = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.DailyPageCounts');", reader => foreignKeys = reader.GetInt32(0));

        jsonOrRowVersionColumns.ShouldBe(0);
        triggers.ShouldBe(0);
        foreignKeys.ShouldBe(0);
    }

    [Fact]
    public async Task TheTestResetEmptiesTheTable()
    {
        await InsertAsync();

        await database.ResetAsync();

        var count = -1;
        await ReadAsync("SELECT COUNT(*) FROM DailyPageCounts;", reader => count = reader.GetInt32(0));
        count.ShouldBe(0);
    }

    private async Task InsertAsync()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = "INSERT INTO DailyPageCounts (BusinessDay, PageKey, Views) VALUES ('2026-11-17', 'home', 1);";
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private async Task ReadAsync(string sql, Action<SqlDataReader> read)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        read(reader);
                    }
                }
            }
        }
    }
}
