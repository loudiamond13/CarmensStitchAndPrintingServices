using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Orders;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>ORD-14, ORD-21, T-07-54: a number another order holds is found by the read and, when two saves race, by the unique index.</summary>
public sealed class OrderNumberTakenTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheUniqueNumberIndexBecomesOrderNumberTakenAtSaveAndLeavesOneRow()
    {
        await database.ResetAsync();
        await SaveAsync(NewOrder("LEG-0042"));
        await using var context = database.CreateContext();
        context.Orders.Add(NewOrder("LEG-0042"));

        await Should.ThrowAsync<OrderNumberTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
        await using var check = database.CreateContext();
        (await check.Orders.AsNoTracking().CountAsync(order => order.Number == "LEG-0042", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheNumberIndexIgnoresLetterCaseSoTheReadAndTheIndexAgree()
    {
        await database.ResetAsync();
        await SaveAsync(NewOrder("LEG-0042"));
        await using var context = database.CreateContext();
        var store = new OrderStore(context);
        context.Orders.Add(NewOrder("leg-0042"));

        (await store.NumberTakenAsync("leg-0042", TestContext.Current.CancellationToken)).ShouldBeTrue();
        await Should.ThrowAsync<OrderNumberTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TheReadSeesLiveAndDeletedOrdersAndNoOtherNumber()
    {
        await database.ResetAsync();
        await SaveAsync(NewOrder("LEG-0042"));
        var deleted = NewOrder("LEG-0043");
        deleted.SoftDelete(Guid.NewGuid(), Now).ShouldBeTrue();
        await using (var context = database.CreateContext())
        {
            context.Orders.Add(deleted);
            context.Entry(deleted).Property(order => order.DeletedById).CurrentValue = null;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var reader = database.CreateContext();
        var store = new OrderStore(reader);

        (await store.NumberTakenAsync("LEG-0042", TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await store.NumberTakenAsync("LEG-0043", TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await store.NumberTakenAsync("LEG-0044", TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task AFailureThatIsNotTheNumberIndexPassesThroughUntouched()
    {
        var lonely = new DbUpdateException("Not a SQL failure.", new InvalidOperationException("plain"));
        OrderStore.TranslateSaveFailure(lonely).ShouldBeNull();
        await database.ResetAsync();
        await using var context = database.CreateContext();
        var order = NewOrder("LEG-0045");
        context.Orders.Add(order);
        context.Entry(order).Property(row => row.CreatedById).CurrentValue = Guid.NewGuid();

        var thrown = await Should.ThrowAsync<DbUpdateException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        thrown.ShouldNotBeOfType<DbUpdateConcurrencyException>();
        OrderStore.TranslateSaveFailure(thrown).ShouldBeNull();
    }

    private async Task SaveAsync(Order order)
    {
        await using var context = database.CreateContext();
        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static Order NewOrder(string number)
    {
        var snapshot = new OrderImportSnapshot(
            number,
            new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 18), new DateOnly(2026, 11, 1), null),
            OrderStatus.Pending,
            [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]);
        return Order.Import(snapshot, OrderImportRules.Default, Now).Value;
    }
}
