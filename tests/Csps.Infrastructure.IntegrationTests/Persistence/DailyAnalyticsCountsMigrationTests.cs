using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// ANL-09, OR-7, PRD 5.4: the AddDailyAnalyticsCounts migration makes DailyReferrerCounts and DailyDeviceCounts with the planned columns and
/// keys, no row version, no JSON column, no trigger and no foreign key, and the test reset empties both.
/// </summary>
public sealed class DailyAnalyticsCountsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] ReferrerColumns =
    [
        ("BusinessDay", "date", 3, false),
        ("Referrer", "varchar", 253, false),
        ("Visits", "int", 4, false),
    ];

    private static readonly (string Name, string Type, int MaxLength, bool Nullable)[] DeviceColumns =
    [
        ("BusinessDay", "date", 3, false),
        ("Dimension", "tinyint", 1, false),
        ("Name", "varchar", 20, false),
        ("Visits", "int", 4, false),
    ];

    [Fact]
    public async Task TheReferrerTableHasExactlyTheThreeColumnsWithTheirTypesLengthsAndNullability()
    {
        (await ColumnsAsync("DailyReferrerCounts")).ShouldBe(ReferrerColumns);
    }

    [Fact]
    public async Task TheDeviceTableHasExactlyTheFourColumnsWithTheirTypesLengthsAndNullability()
    {
        (await ColumnsAsync("DailyDeviceCounts")).ShouldBe(DeviceColumns);
    }

    [Fact]
    public async Task TheDayAndTheSourceTogetherAreTheReferrerPrimaryKey()
    {
        (await PrimaryKeyAsync("DailyReferrerCounts")).ShouldBe(["BusinessDay", "Referrer"]);
    }

    [Fact]
    public async Task TheDayTheDimensionAndTheNameTogetherAreTheDevicePrimaryKey()
    {
        (await PrimaryKeyAsync("DailyDeviceCounts")).ShouldBe(["BusinessDay", "Dimension", "Name"]);
    }

    [Theory]
    [InlineData("DailyReferrerCounts")]
    [InlineData("DailyDeviceCounts")]
    public async Task NeitherTableHasAJsonColumnARowVersionATriggerOrAForeignKey(string table)
    {
        var jsonOrRowVersionColumns = 0;
        var triggers = 0;
        var foreignKeys = 0;

        // A rowversion column is listed as "timestamp" in sys.types.
        await ReadAsync(
            "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            $"WHERE c.object_id = OBJECT_ID(N'dbo.{table}') AND t.name IN (N'json', N'timestamp');",
            reader => jsonOrRowVersionColumns = reader.GetInt32(0));
        await ReadAsync($"SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.{table}');", reader => triggers = reader.GetInt32(0));
        await ReadAsync($"SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.{table}');", reader => foreignKeys = reader.GetInt32(0));

        jsonOrRowVersionColumns.ShouldBe(0);
        triggers.ShouldBe(0);
        foreignKeys.ShouldBe(0);
    }

    [Fact]
    public async Task TheTestResetEmptiesBothTables()
    {
        await ExecuteAsync(
            "INSERT INTO DailyReferrerCounts (BusinessDay, Referrer, Visits) VALUES ('2026-11-14', 'Facebook', 2);" +
            "INSERT INTO DailyDeviceCounts (BusinessDay, Dimension, Name, Visits) VALUES ('2026-11-14', 1, 'Phone', 2);");

        await database.ResetAsync();

        var referrers = -1;
        var devices = -1;
        await ReadAsync("SELECT COUNT(*) FROM DailyReferrerCounts;", reader => referrers = reader.GetInt32(0));
        await ReadAsync("SELECT COUNT(*) FROM DailyDeviceCounts;", reader => devices = reader.GetInt32(0));
        referrers.ShouldBe(0);
        devices.ShouldBe(0);
    }

    private async Task<List<(string Name, string Type, int MaxLength, bool Nullable)>> ColumnsAsync(string table)
    {
        var columns = new List<(string Name, string Type, int MaxLength, bool Nullable)>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            $"WHERE c.object_id = OBJECT_ID(N'dbo.{table}') ORDER BY c.column_id;",
            reader => columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt16(2), reader.GetBoolean(3))));
        return columns;
    }

    private async Task<List<string>> PrimaryKeyAsync(string table)
    {
        var primary = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            $"WHERE i.object_id = OBJECT_ID(N'dbo.{table}') AND i.is_primary_key = 1 ORDER BY ic.key_ordinal;",
            reader => primary.Add(reader.GetString(0)));
        return primary;
    }

    private async Task ExecuteAsync(string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
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
