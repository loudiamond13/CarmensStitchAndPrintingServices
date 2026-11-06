using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// JOB-02, D-20, OR-7: the AddImageDeletions migration makes the ImageDeletions table with its eleven columns and two indexes, the public
/// id index is not unique, and the table has no JSON column and no trigger.
/// </summary>
public sealed class ImageDeletionsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] ExpectedColumns =
    [
        ("Id", "bigint", 8, false),
        ("PublicId", "nvarchar", 400, false),
        ("DeliveryType", "varchar", 16, false),
        ("Reason", "tinyint", 1, false),
        ("EnqueuedAtUtc", "datetimeoffset", 10, false),
        ("Attempts", "int", 4, false),
        ("NextAttemptAtUtc", "datetimeoffset", 10, false),
        ("LeaseUntilUtc", "datetimeoffset", 10, true),
        ("LeaseHolder", "uniqueidentifier", 16, true),
        ("LastFailureCode", "varchar", 50, true),
        ("LastFailedAtUtc", "datetimeoffset", 10, true),
    ];

    [Fact]
    public async Task TheTableHasExactlyTheElevenColumnsWithTheirTypesLengthsAndNullability()
    {
        var columns = new List<(string Name, string Type, int MaxLength, bool Nullable)>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.ImageDeletions') ORDER BY c.column_id;",
            reader => columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt16(2), reader.GetBoolean(3))));

        columns.ShouldBe(ExpectedColumns);
    }

    [Fact]
    public async Task TheIdIsAnIdentityPrimaryKey()
    {
        var identity = 0;
        var primary = new List<string>();
        await ReadAsync("SELECT COLUMNPROPERTY(OBJECT_ID(N'dbo.ImageDeletions'), N'Id', 'IsIdentity');", reader => identity = reader.GetInt32(0));
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.ImageDeletions') AND i.is_primary_key = 1;",
            reader => primary.Add(reader.GetString(0)));

        identity.ShouldBe(1);
        primary.ShouldBe(["Id"]);
    }

    [Fact]
    public async Task BothIndexesExistAndThePublicIdIndexIsNotUnique()
    {
        var indexes = new List<(string Name, string Column, bool Unique)>();
        await ReadAsync(
            "SELECT i.name, c.name, i.is_unique FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            "WHERE i.object_id = OBJECT_ID(N'dbo.ImageDeletions') AND i.is_primary_key = 0 ORDER BY i.name;",
            reader => indexes.Add((reader.GetString(0), reader.GetString(1), reader.GetBoolean(2))));

        indexes.ShouldBe([("IX_ImageDeletions_NextAttemptAtUtc", "NextAttemptAtUtc", false), ("IX_ImageDeletions_PublicId", "PublicId", false)]);
    }

    [Fact]
    public async Task TheTableHasNoJsonColumnNoTriggerAndNoForeignKey()
    {
        var jsonColumns = 0;
        var triggers = 0;
        var foreignKeys = 0;
        await ReadAsync(
            "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            "WHERE c.object_id = OBJECT_ID(N'dbo.ImageDeletions') AND t.name = N'json';",
            reader => jsonColumns = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.ImageDeletions');", reader => triggers = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ImageDeletions');", reader => foreignKeys = reader.GetInt32(0));

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
        await ReadAsync("SELECT COUNT(*) FROM ImageDeletions;", reader => count = reader.GetInt32(0));
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
                    "INSERT INTO ImageDeletions (PublicId, DeliveryType, Reason, EnqueuedAtUtc, Attempts, NextAttemptAtUtc) " +
                    "VALUES (N'csps-test/orders/reset-check', 'private', 3, SYSDATETIMEOFFSET(), 0, SYSDATETIMEOFFSET());";
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
