using Csps.Domain.Expenses;
using Csps.Infrastructure.Identity;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-01, D-19, D-33, PERF-04: the CompanyExpenses table, its checks, its foreign keys and its index set.</summary>
public sealed class CompanyExpensesMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] ExpectedIndexes =
    [
        "IX_CompanyExpenses_CategoryId_ExpenseDate",
        "IX_CompanyExpenses_CreatedById",
        "IX_CompanyExpenses_Deleted",
        "IX_CompanyExpenses_DeletedById",
        "IX_CompanyExpenses_List",
        "IX_CompanyExpenses_PaidByUserId",
        "IX_CompanyExpenses_UpdatedById",
    ];

    [Fact]
    public async Task TheTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync();

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["ExpenseDate"].ShouldBe(new Column("date", null, null, null, false));
        columns["CategoryId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Description"].ShouldBe(new Column("nvarchar", 200, null, null, false));
        columns["Amount"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["PaidByUserId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Notes"].ShouldBe(new Column("nvarchar", 1000, null, null, true));
        columns["RowVersion"].DataType.ShouldBe("timestamp");
        columns["DeletedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, true));
        columns["DeletedById"].ShouldBe(new Column("uniqueidentifier", null, null, null, true));
        columns["CreatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedById"].Nullable.ShouldBeTrue();
        columns["UpdatedAtUtc"].Nullable.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAmountOfZeroIsRefusedByTheCheck()
    {
        var payer = await NewUserAsync();

        var error = await Should.ThrowAsync<SqlException>(() => InsertAsync(payer, 0m));

        error.Message.ShouldContain("CK_CompanyExpenses_Amount_Positive");
    }

    [Fact]
    public async Task ANegativeAmountIsRefusedByTheCheck()
    {
        var payer = await NewUserAsync();

        var error = await Should.ThrowAsync<SqlException>(() => InsertAsync(payer, -1m));

        error.Message.ShouldContain("CK_CompanyExpenses_Amount_Positive");
    }

    [Fact]
    public async Task TheDatabaseHoldsAnAmountOverTheValidatorCapBecauseItChecksOnlyPositive()
    {
        var payer = await NewUserAsync();

        await InsertAsync(payer, 2_000_000.00m);
    }

    [Fact]
    public async Task TheIndexSetIsInPlaceWithTheTwoFilteredIndexes()
    {
        var indexes = await ReadIndexesAsync();

        indexes.Keys.Order(StringComparer.Ordinal).ShouldBe(ExpectedIndexes);
        indexes["IX_CompanyExpenses_List"].ShouldBe("([DeletedAtUtc] IS NULL)");
        indexes["IX_CompanyExpenses_Deleted"].ShouldBe("([DeletedAtUtc] IS NOT NULL)");
    }

    [Fact]
    public async Task TheListIndexLeadsWithTheDateAndCoversTheListColumns()
    {
        var columns = await ReadIndexColumnsAsync("IX_CompanyExpenses_List");

        columns.Where(column => !column.Included).Select(column => (column.Name, column.Descending))
            .ShouldBe([("ExpenseDate", true), ("CreatedAtUtc", true), ("Id", true)]);
        columns.Where(column => column.Included).Select(column => column.Name).Order(StringComparer.Ordinal)
            .ShouldBe(["Amount", "CategoryId", "CreatedById", "PaidByUserId"]);
    }

    [Fact]
    public async Task NoForeignKeyCascadesSoRemovingAPersonNeverRewritesHistory()
    {
        var actions = await ReadForeignKeyActionsAsync();

        actions.Count.ShouldBe(5);
        actions.ShouldAllBe(action => action == "NO_ACTION");
    }

    private async Task<Guid> NewUserAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            var email = $"expense.{Guid.NewGuid():N}@example.com";
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = "Paolo",
                LastName = "Reyes",
            };
            context.Users.Add(user);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            return user.Id;
        }
    }

    // Raw insert so the test reaches the database constraints, not the domain rules.
    private async Task InsertAsync(Guid payer, decimal amount)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "INSERT INTO CompanyExpenses (Id, ExpenseDate, CategoryId, Description, Amount, PaidByUserId, CreatedAtUtc) "
                    + "VALUES (@id, '2026-10-25', @category, N'Thread', @amount, @payer, SYSUTCDATETIME());";
                command.Parameters.AddWithValue("@id", Guid.NewGuid());
                command.Parameters.AddWithValue("@category", ExpenseCategorySeed.OthersId);
                command.Parameters.Add(new SqlParameter("@amount", System.Data.SqlDbType.Decimal) { Precision = 18, Scale = 2, Value = amount });
                command.Parameters.AddWithValue("@payer", payer);
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private async Task<Dictionary<string, Column>> ReadColumnsAsync()
    {
        var result = new Dictionary<string, Column>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE "
            + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompanyExpenses';",
            reader => result[reader.GetString(0)] = new Column(
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetInt32(2),
                reader.IsDBNull(3) ? null : (int)reader.GetByte(3),
                reader.IsDBNull(4) ? null : reader.GetInt32(4),
                reader.GetString(5) == "YES"));
        return result;
    }

    private async Task<Dictionary<string, string?>> ReadIndexesAsync()
    {
        var result = new Dictionary<string, string?>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT i.name, i.filter_definition FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + "WHERE t.name = 'CompanyExpenses' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
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

    private async Task<List<string>> ReadForeignKeyActionsAsync()
    {
        var result = new List<string>();
        await ReadAsync(
            "SELECT fk.delete_referential_action_desc FROM sys.foreign_keys fk "
            + "JOIN sys.tables t ON t.object_id = fk.parent_object_id WHERE t.name = 'CompanyExpenses';",
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

    private sealed record IndexColumn(string Name, bool Descending, bool Included);
}
