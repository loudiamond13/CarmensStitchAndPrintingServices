using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>ORD-05, ORD-23, D-30: the OrderExpenses table, its check, keys, foreign keys and the money-on-hand index.</summary>
public sealed class OrderExpensesMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheExpenseTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync();

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["OrderId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["ExpenseDate"].ShouldBe(new Column("date", null, null, null, false));
        columns["Amount"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["OrderExpenseCategoryId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Description"].ShouldBe(new Column("nvarchar", 200, null, null, true));
        columns["PaidByUserId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Position"].ShouldBe(new Column("int", null, 10, 0, false));
        columns["CreatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, false));
        columns["CreatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedAtUtc"].Nullable.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAmountOfOneCentavoIsAccepted() => await InsertExpenseAsync(await InsertOrderAsync(), 0.01m);

    [Theory]
    [InlineData("0.00")]
    [InlineData("-1.00")]
    public async Task AnAmountOfZeroOrLessIsRefused(string amount)
    {
        var orderId = await InsertOrderAsync();

        var error = await Should.ThrowAsync<SqlException>(() => InsertExpenseAsync(orderId, decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture)));

        error.Message.ShouldContain("CK_OrderExpenses_Amount_Positive");
    }

    [Fact]
    public async Task DeletingAnOrderRemovesItsExpenses()
    {
        var orderId = await InsertOrderAsync();
        await InsertExpenseAsync(orderId, 500m);

        await ExecuteAsync("DELETE FROM Orders WHERE Id = @order;", ("@order", orderId));

        (await CountAsync("SELECT COUNT(*) FROM OrderExpenses WHERE OrderId = @order;", ("@order", orderId))).ShouldBe(0);
    }

    [Fact]
    public async Task OnlyTheOrderKeyCascadesAndEveryCategoryAndPersonKeyIsNoAction()
    {
        var actions = new List<string>();
        await ReadAsync(
            "SELECT fk.delete_referential_action_desc FROM sys.foreign_keys fk "
            + "JOIN sys.tables t ON t.object_id = fk.parent_object_id WHERE t.name = 'OrderExpenses';",
            reader => actions.Add(reader.GetString(0)));

        actions.Order().ShouldBe(["CASCADE", "NO_ACTION", "NO_ACTION", "NO_ACTION", "NO_ACTION"]);
    }

    [Fact]
    public async Task TheIndexSetIsInPlace()
    {
        var names = new List<string>();
        await ReadAsync(
            "SELECT i.name FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + "WHERE t.name = 'OrderExpenses' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
            reader => names.Add(reader.GetString(0)));

        names.ShouldBe(
            [
                "IX_OrderExpenses_CreatedById",
                "IX_OrderExpenses_OrderId",
                "IX_OrderExpenses_OrderExpenseCategoryId",
                "IX_OrderExpenses_PaidByUserId",
                "IX_OrderExpenses_UpdatedById",
            ],
            ignoreOrder: true);
    }

    [Fact]
    public async Task ThePayerIndexCarriesTheAmountAndTheDateForMoneyOnHand()
    {
        var included = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id "
            + "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id "
            + "WHERE i.name = 'IX_OrderExpenses_PaidByUserId' AND ic.is_included_column = 1;",
            reader => included.Add(reader.GetString(0)));

        included.ShouldBe(["Amount", "ExpenseDate"], ignoreOrder: true);
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

    private async Task InsertExpenseAsync(Guid orderId, decimal amount)
    {
        var category = await ScalarGuidAsync("SELECT TOP 1 Id FROM OrderExpenseCategories;");
        await ExecuteAsync(
            "INSERT INTO OrderExpenses (Id, OrderId, ExpenseDate, Amount, OrderExpenseCategoryId, PaidByUserId, Position, CreatedAtUtc) "
            + "VALUES (NEWID(), @order, '2026-10-20', @amount, @category, @payer, 0, SYSUTCDATETIME());",
            ("@order", orderId),
            ("@amount", amount),
            ("@category", category),
            ("@payer", LegacyHolder.Id));
    }

    private async Task<Guid> ScalarGuidAsync(string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return (Guid)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

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
            + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OrderExpenses';",
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
