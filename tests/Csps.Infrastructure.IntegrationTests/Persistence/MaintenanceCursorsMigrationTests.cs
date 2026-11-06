using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// D-54, OR-7: the AddMaintenanceCursors migration makes the MaintenanceCursors table with its three columns, the job name as the
/// primary key, no JSON column, no trigger and no foreign key, and the test reset empties it.
/// </summary>
public sealed class MaintenanceCursorsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] ExpectedColumns =
    [
        ("JobName", "varchar", 50, false),
        ("Position", "nvarchar", 1000, false),
        ("UpdatedAtUtc", "datetimeoffset", 10, false),
    ];

    [Fact]
    public async Task TheTableHasExactlyTheThreeColumnsWithTheirTypesLengthsAndNullability()
    {
        var columns = new List<(string Name, string Type, int MaxLength, bool Nullable)>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.MaintenanceCursors') ORDER BY c.column_id;",
            reader => columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt16(2), reader.GetBoolean(3))));

        columns.ShouldBe(ExpectedColumns);
    }

    [Fact]
    public async Task TheJobNameIsTheOnlyPrimaryKeyColumn()
    {
        var primary = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.MaintenanceCursors') AND i.is_primary_key = 1;",
            reader => primary.Add(reader.GetString(0)));

        primary.ShouldBe(["JobName"]);
    }

    [Fact]
    public async Task TheTableHasNoJsonColumnNoTriggerAndNoForeignKey()
    {
        var jsonColumns = 0;
        var triggers = 0;
        var foreignKeys = 0;
        await ReadAsync(
            "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.MaintenanceCursors') AND t.name = N'json';",
            reader => jsonColumns = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.MaintenanceCursors');", reader => triggers = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.MaintenanceCursors');", reader => foreignKeys = reader.GetInt32(0));

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
        await ReadAsync("SELECT COUNT(*) FROM MaintenanceCursors;", reader => count = reader.GetInt32(0));
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
                    "INSERT INTO MaintenanceCursors (JobName, Position, UpdatedAtUtc) VALUES ('reset-check', N'cursor', SYSDATETIMEOFFSET());";
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
