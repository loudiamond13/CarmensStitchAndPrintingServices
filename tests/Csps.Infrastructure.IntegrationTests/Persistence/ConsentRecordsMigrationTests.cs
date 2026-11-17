using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// ANL-07, OR-7, PRD 5.4: the AddConsentRecords migration makes the ConsentRecords table with its eight columns, the id as the primary key, an
/// index on the decision time, no JSON column, no trigger, no foreign key and no address or browser column, and the test reset empties it.
/// </summary>
public sealed class ConsentRecordsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] ExpectedColumns =
    [
        ("Id", "uniqueidentifier", 16, false),
        ("ConsentId", "uniqueidentifier", 16, false),
        ("PolicyVersion", "varchar", 16, false),
        ("Stats", "bit", 1, true),
        ("Map", "bit", 1, false),
        ("Gpc", "bit", 1, false),
        ("Source", "tinyint", 1, false),
        ("DecidedAtUtc", "datetimeoffset", 10, false),
    ];

    [Fact]
    public async Task TheTableHasExactlyTheEightColumnsWithTheirTypesLengthsAndNullability()
    {
        var columns = new List<(string Name, string Type, int MaxLength, bool Nullable)>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.ConsentRecords') ORDER BY c.column_id;",
            reader => columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt16(2), reader.GetBoolean(3))));

        columns.ShouldBe(ExpectedColumns);
    }

    [Fact]
    public async Task TheIdIsTheOnlyPrimaryKeyColumn()
    {
        var primary = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.ConsentRecords') AND i.is_primary_key = 1;",
            reader => primary.Add(reader.GetString(0)));

        primary.ShouldBe(["Id"]);
    }

    [Fact]
    public async Task TheDecisionTimeHasItsOwnIndex()
    {
        var indexed = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.ConsentRecords') AND i.is_primary_key = 0 AND i.name = N'IX_ConsentRecords_DecidedAtUtc';",
            reader => indexed.Add(reader.GetString(0)));

        indexed.ShouldBe(["DecidedAtUtc"]);
    }

    [Fact]
    public async Task TheTableHasNoJsonColumnNoTriggerAndNoForeignKey()
    {
        var jsonColumns = 0;
        var triggers = 0;
        var foreignKeys = 0;
        await ReadAsync(
            "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.ConsentRecords') AND t.name = N'json';",
            reader => jsonColumns = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.ConsentRecords');", reader => triggers = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ConsentRecords');", reader => foreignKeys = reader.GetInt32(0));

        jsonColumns.ShouldBe(0);
        triggers.ShouldBe(0);
        foreignKeys.ShouldBe(0);
    }

    [Fact]
    public async Task TheTestResetEmptiesTheTable()
    {
        await InsertAsync();

        await database.ResetAsync();

        var count = -1;
        await ReadAsync("SELECT COUNT(*) FROM ConsentRecords;", reader => count = reader.GetInt32(0));
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
                command.CommandText =
                    "INSERT INTO ConsentRecords (Id, ConsentId, PolicyVersion, Stats, Map, Gpc, Source, DecidedAtUtc) " +
                    "VALUES (NEWID(), NEWID(), '0.1', NULL, 0, 0, 1, SYSDATETIMEOFFSET());";
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
