using Csps.LegacyFitCheck.Source;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Tests.Fakes;

/// <summary>A throwaway database shaped like the legacy restore and filled with made-up rows only.</summary>
internal sealed class FakeLegacyDatabase : IAsyncDisposable
{
    public const string SentinelName = "SENTINEL-NAME-7Q";

    /// <summary>The two columns every fake restore holds beyond the mapped ones, standing for creator attribution (Phase 15).</summary>
    public static readonly IReadOnlyList<ShadowColumn> StandardShadowColumns =
    [
        new("Orders", "CreatedBy"),
        new("Payments", "UpdatedBy"),
    ];

    private readonly CspsDatabase _database;
    private readonly IReadOnlyList<ShadowColumn> _shadowColumns;

    private FakeLegacyDatabase(CspsDatabase database, IReadOnlyList<ShadowColumn> shadowColumns)
    {
        _database = database;
        _shadowColumns = shadowColumns;
    }

    public string ConnectionString => _database.ConnectionString;

    /// <summary>Creates the fake restore with one order type, one status, one order and two items, plus any extra shadow columns.</summary>
    public static async Task<FakeLegacyDatabase> CreateWithOneOrderAsync(CancellationToken cancellationToken, params ShadowColumn[] extraColumns)
    {
        var database = await CspsDatabase.CreateEmptyAsync(150).ConfigureAwait(false);
        var fake = new FakeLegacyDatabase(database, [.. StandardShadowColumns, .. extraColumns]);
        try
        {
            var context = fake.OpenWrite();
            await using (context.ConfigureAwait(false))
            {
                await context.Database.EnsureCreatedAsync(cancellationToken).ConfigureAwait(false);
                context.OrderTypes.Add(new LegacyOrderTypeRow { OrderTypeId = 1, OrderTypeName = "Polo Shirt" });
                context.Statuses.Add(new LegacyStatusRow { StatusId = 1, StatusName = "Open" });
                context.Orders.Add(new LegacyOrderRow
                {
                    OrderId = 1,
                    OrderName = SentinelName + " Club",
                    OrderDate = new DateTime(2025, 3, 4, 2, 30, 0, DateTimeKind.Unspecified),
                    TotalAmount = 1700m,
                    Note = null,
                    IsDeleted = false,
                    PaidAmount = 0m,
                    TotalDiscount = 0m,
                    TotalBalance = 1700m,
                    TotalExpenses = 0m,
                    OrderTypeId = 1,
                    StatusId = 1,
                });
                context.OrderItems.AddRange(
                    new LegacyOrderItemRow { OrderItemId = 1, OrderId = 1, Description = "Sample polo", Quantity = 10, Price = 150m },
                    new LegacyOrderItemRow { OrderItemId = 2, OrderId = 1, Description = "Sample cap", Quantity = 5, Price = 40m });
                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            return fake;
        }
        catch
        {
            await fake.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>Adds one more made-up order, as a stray write to the restore would.</summary>
    public async Task AddOrderAsync(int orderId, CancellationToken cancellationToken)
    {
        var context = OpenWrite();
        await using (context.ConfigureAwait(false))
        {
            context.Orders.Add(new LegacyOrderRow
            {
                OrderId = orderId,
                OrderName = "SENTINEL-NAME-7Q Extra",
                OrderDate = new DateTime(2025, 3, 5, 2, 30, 0, DateTimeKind.Unspecified),
                TotalAmount = 100m,
                IsDeleted = false,
                TotalBalance = 100m,
                OrderTypeId = 1,
                StatusId = 1,
            });
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>Adds a made-up order with the exact values the test sets.</summary>
    public Task AddOrderRowAsync(LegacyOrderRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up order item.</summary>
    public Task AddItemAsync(LegacyOrderItemRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up payment.</summary>
    public Task AddPaymentAsync(LegacyPaymentRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up discount.</summary>
    public Task AddDiscountAsync(LegacyDiscountRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up order or company expense.</summary>
    public Task AddExpenseAsync(LegacyExpenseRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up legacy user.</summary>
    public Task AddUserAsync(LegacyUserRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Adds a made-up legacy role.</summary>
    public Task AddRoleAsync(LegacyRoleRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Links a made-up user to a made-up role.</summary>
    public Task AddUserRoleAsync(LegacyUserRoleRow row, CancellationToken cancellationToken) => AddRowAsync(row, cancellationToken);

    /// <summary>Reads the name of one order, for tests that prove a write did not land.</summary>
    public async Task<string?> OrderNameAsync(int orderId, CancellationToken cancellationToken)
    {
        var context = OpenWrite();
        await using (context.ConfigureAwait(false))
        {
            return await context.Orders.Where(row => row.OrderId == orderId).Select(row => row.OrderName).SingleAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>Counts the rows of the two order tables.</summary>
    public async Task<(int Orders, int Items)> CountAsync(CancellationToken cancellationToken)
    {
        var context = OpenWrite();
        await using (context.ConfigureAwait(false))
        {
            var orders = await context.Orders.CountAsync(cancellationToken).ConfigureAwait(false);
            var items = await context.OrderItems.CountAsync(cancellationToken).ConfigureAwait(false);
            return (orders, items);
        }
    }

    public ValueTask DisposeAsync() => _database.DisposeAsync();

    private async Task AddRowAsync<T>(T row, CancellationToken cancellationToken)
        where T : class
    {
        var context = OpenWrite();
        await using (context.ConfigureAwait(false))
        {
            context.Add(row);
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private FakeLegacyWriteContext OpenWrite() => FakeLegacyWriteContext.Open(ConnectionString, _shadowColumns);
}
