using Csps.Domain.Money;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>MONEY-04, D-23, OR-7: the MoneyTransfers table, its two checks, its keys and indexes, and no trigger or query filter.</summary>
public sealed class MoneyTransfersMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Day = new(2026, 10, 20);
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync();

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["FromUserId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["ToUserId"].ShouldBe(new Column("uniqueidentifier", null, null, null, false));
        columns["Amount"].ShouldBe(new Column("decimal", null, 18, 2, false));
        columns["TransferDate"].ShouldBe(new Column("date", null, null, null, false));
        columns["Note"].ShouldBe(new Column("nvarchar", 200, null, null, true));
        columns["IsHandover"].ShouldBe(new Column("bit", null, null, null, false));
        columns["CreatedById"].ShouldBe(new Column("uniqueidentifier", null, null, null, true));
        columns["CreatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, false));
        columns["UpdatedById"].ShouldBe(new Column("uniqueidentifier", null, null, null, true));
        columns["UpdatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, true));
        columns["DeletedById"].ShouldBe(new Column("uniqueidentifier", null, null, null, true));
        columns["DeletedAtUtc"].ShouldBe(new Column("datetimeoffset", null, null, null, true));
        columns["RowVersion"].ShouldBe(new Column("timestamp", null, null, null, false));
        columns.Count.ShouldBe(14);
    }

    [Fact]
    public async Task AValidTransferIsStoredAndIsNotAHandoverUnlessMarked()
    {
        var (from, to) = await TwoPeopleAsync();

        await SaveAsync(from, to, mutate: null);

        await using var context = database.CreateContext();
        var stored = await context.Set<MoneyTransfer>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        stored.Amount.ShouldBe(25.50m);
        stored.IsHandover.ShouldBeFalse();
        stored.TransferDate.ShouldBe(Day);
    }

    [Fact]
    public async Task AnAmountOfOneCentavoIsAccepted()
    {
        var (from, to) = await TwoPeopleAsync();

        await SaveAsync(from, to, entry => entry.Property(row => row.Amount).CurrentValue = 0.01m);
    }

    [Theory]
    [InlineData("0.00")]
    [InlineData("-1.00")]
    public async Task AnAmountOfZeroOrLessIsRefusedByTheCheck(string amount)
    {
        var (from, to) = await TwoPeopleAsync();

        var error = await Should.ThrowAsync<DbUpdateException>(
            () => SaveAsync(from, to, entry => entry.Property(row => row.Amount).CurrentValue = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture)));

        error.InnerException.ShouldBeOfType<SqlException>().Message.ShouldContain("CK_MoneyTransfers_Amount_Positive");
    }

    [Fact]
    public async Task ASenderWhoIsAlsoTheRecipientIsRefusedByTheCheck()
    {
        var (from, to) = await TwoPeopleAsync();

        var error = await Should.ThrowAsync<DbUpdateException>(
            () => SaveAsync(from, to, entry => entry.Property(row => row.ToUserId).CurrentValue = from));

        error.InnerException.ShouldBeOfType<SqlException>().Message.ShouldContain("CK_MoneyTransfers_FromTo_Different");
    }

    [Fact]
    public async Task EveryPeopleKeyIsNoAction()
    {
        var actions = new List<string>();
        await ReadAsync(
            "SELECT fk.delete_referential_action_desc FROM sys.foreign_keys fk "
            + "JOIN sys.tables t ON t.object_id = fk.parent_object_id WHERE t.name = 'MoneyTransfers';",
            reader => actions.Add(reader.GetString(0)));

        actions.ShouldBe(["NO_ACTION", "NO_ACTION", "NO_ACTION", "NO_ACTION", "NO_ACTION"]);
    }

    [Fact]
    public async Task TheSixIndexesAreInPlace()
    {
        var names = new List<string>();
        await ReadAsync(
            "SELECT i.name FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id "
            + "WHERE t.name = 'MoneyTransfers' AND i.is_primary_key = 0 AND i.name IS NOT NULL;",
            reader => names.Add(reader.GetString(0)));

        names.ShouldBe(
            [
                "IX_MoneyTransfers_CreatedById",
                "IX_MoneyTransfers_DeletedById",
                "IX_MoneyTransfers_FromUserId",
                "IX_MoneyTransfers_List",
                "IX_MoneyTransfers_ToUserId",
                "IX_MoneyTransfers_UpdatedById",
            ],
            ignoreOrder: true);
    }

    [Theory]
    [InlineData("IX_MoneyTransfers_FromUserId")]
    [InlineData("IX_MoneyTransfers_ToUserId")]
    public async Task ThePersonIndexesCarryWhatTheBalanceAndTheLedgerRead(string index)
    {
        var included = new List<string>();
        await ReadAsync(
            "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id "
            + $"JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id WHERE i.name = '{index}' AND ic.is_included_column = 1;",
            reader => included.Add(reader.GetString(0)));

        included.ShouldBe(["Amount", "TransferDate", "CreatedAtUtc", "DeletedAtUtc"], ignoreOrder: true);
    }

    [Fact]
    public async Task TheTableHasNoTrigger()
    {
        var triggers = new List<string>();
        await ReadAsync(
            "SELECT tr.name FROM sys.triggers tr JOIN sys.tables t ON t.object_id = tr.parent_id WHERE t.name = 'MoneyTransfers';",
            reader => triggers.Add(reader.GetString(0)));

        triggers.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheModelHasNoQueryFilterOnTransfers()
    {
        await using var context = database.CreateContext();

        var entityType = context.Model.FindEntityType(typeof(MoneyTransfer)).ShouldNotBeNull();

        entityType.GetDeclaredQueryFilters().ShouldBeEmpty();
    }

    private async Task<(Guid From, Guid To)> TwoPeopleAsync()
    {
        await database.ResetAsync();
        var from = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        var to = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        return (from, to);
    }

    // Builds a valid transfer through the domain factory, lets the test bend one value, then saves it.
    private async Task SaveAsync(Guid from, Guid to, Action<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<MoneyTransfer>>? mutate)
    {
        var transfer = MoneyTransfer.Record(
            new MoneyParty(from, "Liza Mercado", MoneyPartyStatus.Active, 25.50m),
            new MoneyParty(to, "Paolo Mercado", MoneyPartyStatus.Active, 0m),
            25.50m,
            Day,
            null,
            callerIsManager: true,
            Day,
            Now).Value;
        await using var context = database.CreateContext();
        context.Set<MoneyTransfer>().Add(transfer);
        var entry = context.Entry(transfer);
        entry.Property(row => row.CreatedById).CurrentValue = from;
        entry.Property(row => row.CreatedAtUtc).CurrentValue = Now;
        mutate?.Invoke(entry);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Dictionary<string, Column>> ReadColumnsAsync()
    {
        var result = new Dictionary<string, Column>(StringComparer.Ordinal);
        await ReadAsync(
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE "
            + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MoneyTransfers';",
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
