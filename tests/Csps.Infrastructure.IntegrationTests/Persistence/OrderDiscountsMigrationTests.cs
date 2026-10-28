using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>ORD-05, D-15: the OrderDiscounts table, its checks, keys and foreign keys.</summary>
public sealed class OrderDiscountsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheDiscountTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync();

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["OrderId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Kind"].ShouldBe(new Column("tinyint", null, 3, 0, false));
        columns["Value"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["Reason"].ShouldBe(new Column("nvarchar", 100, null, null, false));
        columns["Position"].ShouldBe(new Column("int", null, 10, 0, false));
        columns["CreatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, false));
        columns["CreatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedAtUtc"].Nullable.ShouldBeTrue();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task AKindOfOneOrTwoIsAccepted(int kind) => await InsertDiscountAsync(await InsertOrderAsync(), kind, 10m);

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    public async Task AKindOutsideOneAndTwoIsRefused(int kind)
    {
        var orderId = await InsertOrderAsync();

        var error = await Should.ThrowAsync<SqlException>(() => InsertDiscountAsync(orderId, kind, 10m));

        error.Message.ShouldContain("CK_OrderDiscounts_Kind");
    }

    [Theory]
    [InlineData("0.00")]
    [InlineData("-1.00")]
    public async Task AValueOfZeroOrLessIsRefused(string value)
    {
        var orderId = await InsertOrderAsync();

        var error = await Should.ThrowAsync<SqlException>(() => InsertDiscountAsync(orderId, 1, decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)));

        error.Message.ShouldContain("CK_OrderDiscounts_Value_Positive");
    }

    [Fact]
    public async Task DeletingAnOrderRemovesItsDiscounts()
    {
        var orderId = await InsertOrderAsync();
        await InsertDiscountAsync(orderId, 2, 5m);

        await ExecuteAsync("DELETE FROM Orders WHERE Id = @order;", ("@order", orderId));

        (await CountAsync("SELECT COUNT(*) FROM OrderDiscounts WHERE OrderId = @order;", ("@order", orderId))).ShouldBe(0);
    }

    [Fact]
    public async Task OnlyTheOrderKeyCascadesAndEveryPersonKeyIsNoAction()
    {
        var actions = new List<string>();
        await ReadAsync(
            "SELECT fk.delete_referential_action_desc FROM sys.foreign_keys fk "
            + "JOIN sys.tables t ON t.object_id = fk.parent_object_id WHERE t.name = 'OrderDiscounts';",
            reader => actions.Add(reader.GetString(0)));

        actions.Order().ShouldBe(["CASCADE", "NO_ACTION", "NO_ACTION"]);
    }

    [Fact]
    public async Task TheIndexSetIsInPlace()
    {
        var names = new List<string>();
        await ReadAsync(
            "SELECT i.name FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + "WHERE t.name = 'OrderDiscounts' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
            reader => names.Add(reader.GetString(0)));

        names.ShouldBe(["IX_OrderDiscounts_CreatedById", "IX_OrderDiscounts_OrderId", "IX_OrderDiscounts_UpdatedById"], ignoreOrder: true);
    }

    private async Task<Guid> InsertOrderAsync()
    {
        var id = Guid.NewGuid();
        await ExecuteAsync(
            "INSERT INTO Orders (Id, Number, CustomerName, OrderDate, Status, StatusChangedAtUtc, Subtotal, DiscountTotal, Total, PaidTotal, RefundedTotal, Balance, CustomerCredit, ExpensesTotal, Profit, FullyPaid, EditVersion, CreatedAtUtc) "
            + "VALUES (@id, @number, N'Juan', '2026-10-28', 1, SYSUTCDATETIME(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NEWID(), SYSUTCDATETIME());",
            ("@id", id),
            ("@number", "T-" + Guid.NewGuid().ToString("N")[..20]));
        return id;
    }

    private Task InsertDiscountAsync(Guid orderId, int kind, decimal value) =>
        ExecuteAsync(
            "INSERT INTO OrderDiscounts (Id, OrderId, Kind, Value, Reason, Position, CreatedAtUtc) "
            + "VALUES (NEWID(), @order, @kind, @value, N'League', 0, SYSUTCDATETIME());",
            ("@order", orderId),
            ("@kind", (byte)kind),
            ("@value", value));

    private async Task ExecuteAsync(string sql, params (string Name, object Value)[] parameters)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                AddParameters(command, parameters);
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private async Task<int> CountAsync(string sql, params (string Name, object Value)[] parameters)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                AddParameters(command, parameters);
                return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static void AddParameters(SqlCommand command, (string Name, object Value)[] parameters)
    {
        foreach (var (name, value) in parameters)
        {
            var parameter = value is decimal money
                ? new SqlParameter(name, System.Data.SqlDbType.Decimal) { Precision = 18, Scale = 2, Value = money }
                : new SqlParameter(name, value);
            command.Parameters.Add(parameter);
        }
    }

    private async Task<Dictionary<string, Column>> ReadColumnsAsync()
    {
        var result = new Dictionary<string, Column>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE "
            + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OrderDiscounts';",
            reader => result[reader.GetString(0)] = new Column(
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetInt32(2),
                reader.IsDBNull(3) ? null : (int)reader.GetByte(3),
                reader.IsDBNull(4) ? null : reader.GetInt32(4),
                reader.GetString(5) == "YES"));
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

    private sealed record Column(string DataType, int? MaxLength, int? Precision, int? Scale, bool Nullable);
}
