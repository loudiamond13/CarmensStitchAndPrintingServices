using Csps.Domain.OrderLists;
using Csps.Infrastructure.Identity;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>ORD-03, ORD-14, D-23, D-26: the Orders, OrderItems, OrderStatusChanges and OrderNumberCounters tables, their checks, keys and foreign keys.</summary>
public sealed class OrdersMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid ProductTypeId = OrderListSeed.ProductTypes[0].Id;

    [Fact]
    public async Task TheOrdersTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync("Orders");

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Number"].ShouldBe(new Column("varchar", 32, null, null, false));
        columns["CustomerName"].ShouldBe(new Column("nvarchar", 100, null, null, false));
        columns["TeamName"].ShouldBe(new Column("nvarchar", 100, null, null, true));
        columns["ContactNumber"].ShouldBe(new Column("nvarchar", 30, null, null, true));
        columns["Email"].ShouldBe(new Column("nvarchar", 254, null, null, true));
        columns["Address"].ShouldBe(new Column("nvarchar", 300, null, null, true));
        columns["OrderDate"].ShouldBe(new Column("date", null, null, null, false));
        columns["DueDate"].ShouldBe(new Column("date", null, null, null, true));
        columns["Status"].ShouldBe(new Column("tinyint", null, 3, 0, false));
        columns["StatusChangedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, false));
        columns["Notes"].ShouldBe(new Column("nvarchar", 2000, null, null, true));
        foreach (var money in new[] { "Subtotal", "DiscountTotal", "Total", "PaidTotal", "RefundedTotal", "Balance", "CustomerCredit", "ExpensesTotal", "Profit" })
        {
            columns[money].ShouldBe(new Column("decimal", null, 18, 2, false), money);
        }

        columns["FullyPaid"].ShouldBe(new Column("bit", null, null, null, false));
        columns["EditVersion"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["RowVersion"].DataType.ShouldBe("timestamp");
        columns["DeletedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, true));
        columns["DeletedById"].ShouldBe(new Column("uniqueidentifier", null, null, null, true));
        columns["CreatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedAtUtc"].Nullable.ShouldBeTrue();
    }

    [Fact]
    public async Task TheItemTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync("OrderItems");

        columns["Description"].ShouldBe(new Column("nvarchar", 200, null, null, false));
        columns["SizeVariant"].ShouldBe(new Column("nvarchar", 100, null, null, true));
        columns["Quantity"].ShouldBe(new Column("int", null, 10, 0, false));
        columns["UnitPrice"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["LineTotal"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["Position"].ShouldBe(new Column("int", null, 10, 0, false));
        columns["ProductTypeId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["OrderId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
    }

    [Fact]
    public async Task TheStatusHistoryAndCounterTablesHaveTheirColumns()
    {
        var changes = await ReadColumnsAsync("OrderStatusChanges");
        var counters = await ReadColumnsAsync("OrderNumberCounters");

        changes["FromStatus"].ShouldBe(new Column("tinyint", null, 3, 0, true));
        changes["ToStatus"].ShouldBe(new Column("tinyint", null, 3, 0, false));
        changes["ChangedById"].Nullable.ShouldBeTrue();
        changes["ChangedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, false));
        counters["Year"].ShouldBe(new Column("int", null, 10, 0, false));
        counters["LastValue"].ShouldBe(new Column("int", null, 10, 0, false));
    }

    [Fact]
    public async Task TheOrderNumberIsUnique()
    {
        var number = NewNumber();
        await InsertOrderAsync(number);

        var error = await Should.ThrowAsync<SqlException>(() => InsertOrderAsync(number));

        error.Number.ShouldBe(2601);
        error.Message.ShouldContain("IX_Orders_Number");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public async Task AStatusOutsideOneToSevenIsRefused(int status)
    {
        var error = await Should.ThrowAsync<SqlException>(() => InsertOrderAsync(NewNumber(), status: status));

        error.Message.ShouldContain("CK_Orders_Status");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(7)]
    public async Task AStatusOfOneAndSevenIsAccepted(int status) => await InsertOrderAsync(NewNumber(), status: status);

    [Fact]
    public async Task ATotalThatIsNotTheSubtotalMinusTheDiscountIsRefused()
    {
        var error = await Should.ThrowAsync<SqlException>(() => InsertOrderAsync(NewNumber(), subtotal: 100m, discount: 10m, total: 95m, balance: 95m, profit: 95m));

        error.Message.ShouldContain("CK_Orders_Total");
    }

    [Fact]
    public async Task ABalanceThatIsNotTheTotalMinusPaidPlusRefundedIsRefused()
    {
        var error = await Should.ThrowAsync<SqlException>(() => InsertOrderAsync(NewNumber(), subtotal: 100m, total: 100m, paid: 40m, balance: 70m));

        error.Message.ShouldContain("CK_Orders_Balance");
    }

    [Fact]
    public async Task ACustomerCreditThatDoesNotMatchTheBalanceIsRefused()
    {
        var error = await Should.ThrowAsync<SqlException>(() => InsertOrderAsync(NewNumber(), subtotal: 100m, total: 100m, paid: 150m, balance: -50m, credit: 0m));

        error.Message.ShouldContain("CK_Orders_CustomerCredit");
    }

    [Fact]
    public async Task AnOverpaidSnapshotWithItsCreditIsAccepted() =>
        await InsertOrderAsync(NewNumber(), subtotal: 100m, total: 100m, paid: 150m, balance: -50m, credit: 50m);

    [Fact]
    public async Task ANegativeQuantityOrUnitPriceIsRefusedByTheItemChecks()
    {
        var orderId = await InsertOrderAsync(NewNumber());

        var quantity = await Should.ThrowAsync<SqlException>(() => InsertItemAsync(orderId, quantity: -1, unitPrice: 10m));
        var price = await Should.ThrowAsync<SqlException>(() => InsertItemAsync(orderId, quantity: 1, unitPrice: -1m));

        quantity.Message.ShouldContain("CK_OrderItems_Quantity_NonNegative");
        price.Message.ShouldContain("CK_OrderItems_UnitPrice_NonNegative");
    }

    [Fact]
    public async Task ACounterBelowZeroIsRefused()
    {
        var error = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("INSERT INTO OrderNumberCounters ([Year], LastValue) VALUES (9001, -1);"));

        error.Message.ShouldContain("CK_OrderNumberCounters_LastValue");
    }

    [Fact]
    public async Task TheCounterKeyIsTheYear()
    {
        await ExecuteAsync("INSERT INTO OrderNumberCounters ([Year], LastValue) VALUES (9002, 0);");

        var error = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("INSERT INTO OrderNumberCounters ([Year], LastValue) VALUES (9002, 1);"));

        error.Number.ShouldBe(2627);
    }

    [Fact]
    public async Task DeletingAnOrderRemovesItsItemsAndHistoryButNeverTheProductType()
    {
        var orderId = await InsertOrderAsync(NewNumber());
        await InsertItemAsync(orderId, quantity: 1, unitPrice: 10m);
        await ExecuteAsync(
            "INSERT INTO OrderStatusChanges (Id, OrderId, FromStatus, ToStatus, ChangedAtUtc) VALUES (NEWID(), @order, NULL, 1, SYSUTCDATETIME());",
            ("@order", orderId));

        await ExecuteAsync("DELETE FROM Orders WHERE Id = @order;", ("@order", orderId));

        (await CountAsync("SELECT COUNT(*) FROM OrderItems WHERE OrderId = @order;", ("@order", orderId))).ShouldBe(0);
        (await CountAsync("SELECT COUNT(*) FROM OrderStatusChanges WHERE OrderId = @order;", ("@order", orderId))).ShouldBe(0);
        (await CountAsync("SELECT COUNT(*) FROM ProductTypes WHERE Id = @type;", ("@type", ProductTypeId))).ShouldBe(1);
    }

    [Fact]
    public async Task AProductTypeThatAnItemUsesCannotBeDeleted()
    {
        var orderId = await InsertOrderAsync(NewNumber());
        await InsertItemAsync(orderId, quantity: 1, unitPrice: 10m);

        var error = await Should.ThrowAsync<SqlException>(() => ExecuteAsync("DELETE FROM ProductTypes WHERE Id = @type;", ("@type", ProductTypeId)));

        error.Number.ShouldBe(547);
    }

    [Fact]
    public async Task OnlyTheOrderToItemsAndHistoryKeysCascadeAndEveryPersonKeyIsNoAction()
    {
        var orders = await ReadForeignKeyActionsAsync("Orders");
        var items = await ReadForeignKeyActionsAsync("OrderItems");
        var changes = await ReadForeignKeyActionsAsync("OrderStatusChanges");

        orders.ShouldAllBe(action => action == "NO_ACTION");
        orders.Count.ShouldBe(3);
        items.Order().ShouldBe(["CASCADE", "NO_ACTION", "NO_ACTION", "NO_ACTION"]);
        changes.Order().ShouldBe(["CASCADE", "NO_ACTION"]);
    }

    [Fact]
    public async Task TheIndexSetIsInPlace()
    {
        (await ReadIndexNamesAsync("Orders")).ShouldBe(["IX_Orders_CreatedById", "IX_Orders_DeletedById", "IX_Orders_Number", "IX_Orders_UpdatedById"], ignoreOrder: true);
        (await ReadIndexNamesAsync("OrderItems")).ShouldBe(["IX_OrderItems_CreatedById", "IX_OrderItems_OrderId", "IX_OrderItems_ProductTypeId", "IX_OrderItems_UpdatedById"], ignoreOrder: true);
        (await ReadIndexNamesAsync("OrderStatusChanges")).ShouldBe(["IX_OrderStatusChanges_ChangedById", "IX_OrderStatusChanges_OrderId"], ignoreOrder: true);
    }

    private static string NewNumber() => "T-" + Guid.NewGuid().ToString("N")[..20];

    private async Task<Guid> InsertOrderAsync(
        string number,
        int status = 1,
        decimal subtotal = 0m,
        decimal discount = 0m,
        decimal total = 0m,
        decimal paid = 0m,
        decimal refunded = 0m,
        decimal balance = 0m,
        decimal credit = 0m,
        decimal profit = 0m)
    {
        var id = Guid.NewGuid();
        await ExecuteAsync(
            "INSERT INTO Orders (Id, Number, CustomerName, OrderDate, Status, StatusChangedAtUtc, Subtotal, DiscountTotal, Total, PaidTotal, RefundedTotal, Balance, CustomerCredit, ExpensesTotal, Profit, FullyPaid, EditVersion, CreatedAtUtc) "
            + "VALUES (@id, @number, N'Juan', '2026-10-28', @status, SYSUTCDATETIME(), @subtotal, @discount, @total, @paid, @refunded, @balance, @credit, 0, @profit, 0, NEWID(), SYSUTCDATETIME());",
            ("@id", id),
            ("@number", number),
            ("@status", (byte)status),
            ("@subtotal", subtotal),
            ("@discount", discount),
            ("@total", total),
            ("@paid", paid),
            ("@refunded", refunded),
            ("@balance", balance),
            ("@credit", credit),
            ("@profit", profit));
        return id;
    }

    private Task InsertItemAsync(Guid orderId, int quantity, decimal unitPrice) =>
        ExecuteAsync(
            "INSERT INTO OrderItems (Id, OrderId, ProductTypeId, Description, Quantity, UnitPrice, LineTotal, Position, CreatedAtUtc) "
            + "VALUES (NEWID(), @order, @type, N'Jersey', @quantity, @price, 0, 0, SYSUTCDATETIME());",
            ("@order", orderId),
            ("@type", ProductTypeId),
            ("@quantity", quantity),
            ("@price", unitPrice));

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

    private async Task<Dictionary<string, Column>> ReadColumnsAsync(string table)
    {
        var result = new Dictionary<string, Column>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE "
            + $"FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}';",
            reader => result[reader.GetString(0)] = new Column(
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetInt32(2),
                reader.IsDBNull(3) ? null : (int)reader.GetByte(3),
                reader.IsDBNull(4) ? null : reader.GetInt32(4),
                reader.GetString(5) == "YES"));
        return result;
    }

    private async Task<List<string>> ReadIndexNamesAsync(string table)
    {
        var result = new List<string>();
        await ReadAsync(
            "SELECT i.name FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + $"WHERE t.name = '{table}' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
            reader => result.Add(reader.GetString(0)));
        return result;
    }

    private async Task<List<string>> ReadForeignKeyActionsAsync(string table)
    {
        var result = new List<string>();
        await ReadAsync(
            "SELECT fk.delete_referential_action_desc FROM sys.foreign_keys fk "
            + $"JOIN sys.tables t ON t.object_id = fk.parent_object_id WHERE t.name = '{table}';",
            reader => result.Add(reader.GetString(0)));
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
