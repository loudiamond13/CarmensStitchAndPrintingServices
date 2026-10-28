using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>PERF-04, ORD-01, ORD-02: the index set behind the order list, its filters and its sorts.</summary>
public sealed class OrderListIndexesMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LiveOnly = "([DeletedAtUtc] IS NULL)";

    private static readonly string[] ExistingIndexes = ["IX_Orders_CreatedById", "IX_Orders_DeletedById", "IX_Orders_Number", "IX_Orders_UpdatedById"];

    private static readonly string[] ListIndexes =
    [
        "IX_Orders_Balance",
        "IX_Orders_CreatedAtUtc",
        "IX_Orders_List_Due",
        "IX_Orders_OrderDate",
        "IX_Orders_Status_StatusChangedAtUtc",
        "IX_Orders_Total",
    ];

    [Fact]
    public async Task TheOrdersIndexSetHoldsTheOldIndexesAndTheSixListIndexes()
    {
        var indexes = await ReadIndexesAsync("Orders");

        indexes.Keys.Order(StringComparer.Ordinal).ShouldBe(
            [.. ExistingIndexes.Concat(ListIndexes).Order(StringComparer.Ordinal)]);
    }

    [Fact]
    public async Task EveryListIndexKeepsOnlyLiveOrdersAndTheNumberIndexStaysUnfiltered()
    {
        var indexes = await ReadIndexesAsync("Orders");

        foreach (var name in ListIndexes)
        {
            indexes[name].ShouldBe(LiveOnly, name);
        }

        indexes["IX_Orders_Number"].ShouldBeNull();
    }

    [Fact]
    public async Task TheDueIndexLeadsWithTheDueDateEndsOnTheIdAndCoversTheListColumns()
    {
        var columns = await ReadIndexColumnsAsync("IX_Orders_List_Due");

        columns.Where(column => !column.Included).Select(column => (column.Name, column.Descending)).ShouldBe([("DueDate", false), ("Id", false)]);
        columns.Where(column => column.Included).Select(column => column.Name).Order(StringComparer.Ordinal).ShouldBe(
        [
            "Balance",
            "CustomerCredit",
            "CustomerName",
            "DiscountTotal",
            "FullyPaid",
            "Number",
            "OrderDate",
            "PaidTotal",
            "RefundedTotal",
            "Status",
            "StatusChangedAtUtc",
            "Subtotal",
            "TeamName",
            "Total",
        ]);
    }

    [Theory]
    [InlineData("IX_Orders_Status_StatusChangedAtUtc", new[] { "Status:asc", "StatusChangedAtUtc:asc" })]
    [InlineData("IX_Orders_OrderDate", new[] { "OrderDate:desc", "CreatedAtUtc:desc", "Id:asc" })]
    [InlineData("IX_Orders_CreatedAtUtc", new[] { "CreatedAtUtc:desc" })]
    [InlineData("IX_Orders_Balance", new[] { "Balance:desc", "Id:asc" })]
    [InlineData("IX_Orders_Total", new[] { "Total:desc", "Id:asc" })]
    public async Task EachSortIndexHasTheKeysAndDirectionsOfItsSort(string name, string[] expected)
    {
        var columns = await ReadIndexColumnsAsync(name);

        columns.Where(column => !column.Included).Select(column => $"{column.Name}:{(column.Descending ? "desc" : "asc")}").ShouldBe(expected);
    }

    [Fact]
    public async Task TheProductTypeIndexLeadsWithTheTypeAndCarriesTheOrderId()
    {
        var indexes = await ReadIndexesAsync("OrderItems");
        var columns = await ReadIndexColumnsAsync("IX_OrderItems_ProductTypeId_OrderId");

        indexes.Keys.ShouldContain("IX_OrderItems_ProductTypeId_OrderId");
        indexes["IX_OrderItems_ProductTypeId_OrderId"].ShouldBeNull();
        columns.Select(column => (column.Name, column.Descending, column.Included)).ShouldBe([("ProductTypeId", false, false), ("OrderId", false, false)]);
    }

    private async Task<Dictionary<string, string?>> ReadIndexesAsync(string table)
    {
        var result = new Dictionary<string, string?>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT i.name, i.filter_definition FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + $"WHERE t.name = '{table}' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
            reader => result[reader.GetString(0)] = reader.IsDBNull(1) ? null : reader.GetString(1));
        return result;
    }

    private async Task<List<IndexColumn>> ReadIndexColumnsAsync(string indexName)
    {
        var result = new List<IndexColumn>();
        await ReadAsync(
            "SELECT c.name, ic.is_descending_key, ic.is_included_column FROM sys.indexes i "
            + "JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id "
            + "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id "
            + $"WHERE i.name = '{indexName}' ORDER BY ic.is_included_column, ic.key_ordinal;",
            reader => result.Add(new IndexColumn(reader.GetString(0), reader.GetBoolean(1), reader.GetBoolean(2))));
        return result;
    }

    private async Task ReadAsync(string sql, Action<SqlDataReader> each)
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
                        each(reader);
                    }
                }
            }
        }
    }

    private sealed record IndexColumn(string Name, bool Descending, bool Included);
}
