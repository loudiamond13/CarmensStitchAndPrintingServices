using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// ANL-05, OR-7, PRD 5.4: the AddAnalyticsVisits migration makes the four analytics tables with the planned columns, keys, indexes and cascading
/// foreign keys, and no JSON column, no row version and no trigger. The test reset empties them.
/// </summary>
public sealed class AnalyticsVisitsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] Tables = ["AnalyticsVisits", "AnalyticsPageViews", "AnalyticsVitalSamples", "AnalyticsSalts"];

    [Fact]
    public async Task AnalyticsVisitsHasTheReducedColumnsOnly()
    {
        (await ColumnsAsync("AnalyticsVisits")).ShouldBe(
        [
            "Id uniqueidentifier 16 False",
            "VisitorHash binary 32 False",
            "BusinessDay date 3 False",
            "StartedAtUtc datetimeoffset 10 False",
            "LastSeenAtUtc datetimeoffset 10 False",
            "Referrer varchar 253 False",
            "Device tinyint 1 False",
            "Browser varchar 20 False",
            "Os varchar 20 False",
            "IpHash binary 32 True",
            "PageViews int 4 False",
        ]);
    }

    [Fact]
    public async Task AnalyticsPageViewsHasTheKeyAndTheDayOnly()
    {
        (await ColumnsAsync("AnalyticsPageViews")).ShouldBe(
        [
            "Id bigint 8 False",
            "VisitId uniqueidentifier 16 False",
            "BusinessDay date 3 False",
            "OccurredAtUtc datetimeoffset 10 False",
            "PageKey varchar 32 False",
        ]);
    }

    [Fact]
    public async Task AnalyticsVitalSamplesHasTheMetricAndTheValue()
    {
        (await ColumnsAsync("AnalyticsVitalSamples")).ShouldBe(
        [
            "Id bigint 8 False",
            "VisitId uniqueidentifier 16 False",
            "BusinessDay date 3 False",
            "Metric tinyint 1 False",
            "Value decimal 5 False",
            "PageKey varchar 32 False",
        ]);
        var scale = -1;
        await ReadAsync(
            "SELECT c.scale FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.AnalyticsVitalSamples') AND c.name = N'Value';",
            reader => scale = reader.GetByte(0));
        scale.ShouldBe(3);
    }

    [Fact]
    public async Task AnalyticsSaltsKeepsOneSaltPerDay()
    {
        (await ColumnsAsync("AnalyticsSalts")).ShouldBe(["BusinessDay date 3 False", "Salt binary 32 False"]);
        (await PrimaryKeyAsync("AnalyticsSalts")).ShouldBe(["BusinessDay"]);
    }

    [Theory]
    [InlineData("AnalyticsVisits", "Id")]
    [InlineData("AnalyticsPageViews", "Id")]
    [InlineData("AnalyticsVitalSamples", "Id")]
    public async Task EachRowTableHasAnIdPrimaryKey(string table, string column)
    {
        (await PrimaryKeyAsync(table)).ShouldBe([column]);
    }

    [Fact]
    public async Task TheVisitsTableHasTheVisitorAndTheDayIndexes()
    {
        (await IndexKeysAsync("AnalyticsVisits", "IX_AnalyticsVisits_VisitorHash_LastSeenAtUtc")).ShouldBe(["VisitorHash", "LastSeenAtUtc"]);
        (await IndexKeysAsync("AnalyticsVisits", "IX_AnalyticsVisits_BusinessDay")).ShouldBe(["BusinessDay"]);
        (await IncludedColumnsAsync("AnalyticsVisits", "IX_AnalyticsVisits_BusinessDay")).Order().ShouldBe(["Browser", "Device", "Referrer", "VisitorHash"]);
    }

    [Fact]
    public async Task ThePageViewAndSampleTablesHaveTheirIndexes()
    {
        (await IndexKeysAsync("AnalyticsPageViews", "IX_AnalyticsPageViews_VisitId")).ShouldBe(["VisitId"]);
        (await IndexKeysAsync("AnalyticsPageViews", "IX_AnalyticsPageViews_BusinessDay")).ShouldBe(["BusinessDay"]);
        (await IndexKeysAsync("AnalyticsVitalSamples", "IX_AnalyticsVitalSamples_BusinessDay_Metric_Value")).ShouldBe(["BusinessDay", "Metric", "Value"]);
    }

    [Theory]
    [InlineData("AnalyticsPageViews")]
    [InlineData("AnalyticsVitalSamples")]
    public async Task TheChildTablesHaveACascadingForeignKeyToTheVisit(string table)
    {
        var rules = new List<string>();
        await ReadAsync(
            $"SELECT fk.delete_referential_action_desc + N' ' + OBJECT_NAME(fk.referenced_object_id) FROM sys.foreign_keys fk WHERE fk.parent_object_id = OBJECT_ID(N'dbo.{table}');",
            reader => rules.Add(reader.GetString(0)));

        rules.ShouldBe(["CASCADE AnalyticsVisits"]);
    }

    [Fact]
    public async Task NoAnalyticsTableHasAJsonColumnARowVersionOrATrigger()
    {
        foreach (var table in Tables)
        {
            var jsonOrRowVersion = 0;
            var triggers = 0;
            await ReadAsync(
                "SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
                $"WHERE c.object_id = OBJECT_ID(N'dbo.{table}') AND t.name IN (N'json', N'timestamp');",
                reader => jsonOrRowVersion = reader.GetInt32(0));
            await ReadAsync($"SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.{table}');", reader => triggers = reader.GetInt32(0));

            jsonOrRowVersion.ShouldBe(0, table);
            triggers.ShouldBe(0, table);
        }
    }

    [Fact]
    public async Task TheTestResetEmptiesAllFourTables()
    {
        await ExecuteAsync(
            "INSERT INTO AnalyticsSalts (BusinessDay, Salt) VALUES ('2026-11-17', 0x0000000000000000000000000000000000000000000000000000000000000001);");

        await database.ResetAsync();

        var count = -1;
        await ReadAsync("SELECT COUNT(*) FROM AnalyticsSalts;", reader => count = reader.GetInt32(0));
        count.ShouldBe(0);
    }

    private async Task<List<string>> ColumnsAsync(string table)
    {
        var columns = new List<string>();
        await ReadAsync(
            "SELECT c.name, t.name, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id " +
            $"WHERE c.object_id = OBJECT_ID(N'dbo.{table}') ORDER BY c.column_id;",
            reader => columns.Add($"{reader.GetString(0)} {reader.GetString(1)} {reader.GetInt16(2)} {reader.GetBoolean(3)}"));
        return columns;
    }

    private async Task<List<string>> PrimaryKeyAsync(string table)
    {
        var keys = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            $"WHERE i.object_id = OBJECT_ID(N'dbo.{table}') AND i.is_primary_key = 1 ORDER BY ic.key_ordinal;",
            reader => keys.Add(reader.GetString(0)));
        return keys;
    }

    private async Task<List<string>> IndexKeysAsync(string table, string index) => await IndexColumnsAsync(table, index, included: false);

    private async Task<List<string>> IncludedColumnsAsync(string table, string index) => await IndexColumnsAsync(table, index, included: true);

    private async Task<List<string>> IndexColumnsAsync(string table, string index, bool included)
    {
        var columns = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id " +
            "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
            $"WHERE i.object_id = OBJECT_ID(N'dbo.{table}') AND i.name = N'{index}' AND ic.is_included_column = {(included ? 1 : 0)} ORDER BY ic.key_ordinal, c.column_id;",
            reader => columns.Add(reader.GetString(0)));
        return columns;
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
