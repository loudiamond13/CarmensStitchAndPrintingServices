using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>
/// PERF-04, D-28: the deleted-order list runs two SQL commands whatever the page size, newest deletion first, live orders never listed.
/// D-24, ORD-06: one deleted order is read with every child row, because each child query lifts its own soft-delete filter.
/// </summary>
public sealed class OrderReaderDeletedListTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int DeletedCount = 120;
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    [InlineData(100)]
    public async Task APageOfAnySizeRunsExactlyTwoCommands(int pageSize)
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListDeletedAsync(1, pageSize, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.Count.ShouldBe(pageSize);
        page.Total.ShouldBe(DeletedCount);
    }

    [Fact]
    public async Task AnEmptyListStillRunsExactlyTwoCommands()
    {
        await database.ResetAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListDeletedAsync(1, 20, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
    }

    [Fact]
    public async Task TheListHoldsOnlyDeletedOrdersNewestDeletionFirstAndPagesDoNotOverlap()
    {
        var (deletedIds, liveId) = await SeedAsync();
        await using var context = database.CreateContext();
        var reader = new OrderReader(context, new FixedBusinessCalendar(Now));

        var first = await reader.ListDeletedAsync(1, 100, TestContext.Current.CancellationToken);
        var second = await reader.ListDeletedAsync(2, 100, TestContext.Current.CancellationToken);

        first.Items.Count.ShouldBe(100);
        second.Items.Count.ShouldBe(DeletedCount - 100);
        var all = first.Items.Concat(second.Items).ToList();
        all.Select(static row => row.Id).Distinct().Count().ShouldBe(DeletedCount);
        all.Select(static row => row.Id).ShouldNotContain(liveId);
        all.Select(static row => row.DeletedAtUtc).ShouldBe(all.Select(static row => row.DeletedAtUtc).OrderDescending());
        all[0].Id.ShouldBe(deletedIds[^1]);
        all[0].DeletedBy.ShouldNotBeNull().FormerStaff.ShouldBeFalse();
        all[0].Total.ShouldBe(1300.00m);
        all[0].Balance.ShouldBe(1300.00m);
    }

    [Fact]
    public async Task ADeletedOrderIsReadWithEveryChildRowItsTotalsAndWhoDeletedIt()
    {
        var id = await SeedOrderWithChildrenAsync(deleted: true);
        await using var context = database.CreateContext();

        var read = await new OrderReader(context, new FixedBusinessCalendar(Now)).GetDeletedDetailAsync(id, TestContext.Current.CancellationToken);

        var deleted = read.ShouldNotBeNull();
        deleted.DeletedAt.ShouldBe(Now.AddMinutes(5));
        deleted.DeletedBy.ShouldNotBeNull().Name.ShouldBe("Mina Mercado");
        var order = deleted.Order;
        order.Items.Count.ShouldBe(2);
        order.Discounts.Count.ShouldBe(1);
        order.Payments.Count.ShouldBe(1);
        order.Refunds.Count.ShouldBe(1);
        order.Expenses.Count.ShouldBe(1);
        order.StatusHistory.Count.ShouldBe(3);
        order.Totals.Subtotal.ShouldBe(1800.00m);
        order.Totals.Total.ShouldBe(1700.00m);
        order.Totals.Paid.ShouldBe(1000.00m);
        order.Totals.Refunded.ShouldBe(300.00m);
        order.Totals.Expenses.ShouldBe(200.00m);
        order.Today.ShouldBe(new DateOnly(2026, 10, 28));
    }

    [Fact]
    public async Task ALiveOrderAnUnknownIdAndARestoredOrderAreNotReadAsDeleted()
    {
        var liveId = await SeedOrderWithChildrenAsync(deleted: false);
        await using var context = database.CreateContext();
        var reader = new OrderReader(context, new FixedBusinessCalendar(Now));

        var live = await reader.GetDeletedDetailAsync(liveId, TestContext.Current.CancellationToken);
        var unknown = await reader.GetDeletedDetailAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);
        await context.Orders.IgnoreQueryFilters(["SoftDelete"]).Where(order => order.Id == liveId)
            .ExecuteUpdateAsync(set => set.SetProperty(order => order.DeletedAtUtc, Now).SetProperty(order => order.DeletedById, (Guid?)null), TestContext.Current.CancellationToken);
        var systemDeleted = await reader.GetDeletedDetailAsync(liveId, TestContext.Current.CancellationToken);
        await context.Orders.IgnoreQueryFilters(["SoftDelete"]).Where(order => order.Id == liveId)
            .ExecuteUpdateAsync(set => set.SetProperty(order => order.DeletedAtUtc, (DateTimeOffset?)null), TestContext.Current.CancellationToken);
        var restored = await reader.GetDeletedDetailAsync(liveId, TestContext.Current.CancellationToken);

        live.ShouldBeNull();
        unknown.ShouldBeNull();
        systemDeleted.ShouldNotBeNull().DeletedBy.ShouldBeNull();
        restored.ShouldBeNull();
    }

    [Fact]
    public async Task AnOrderThatIsDeletedStillReadsAsNothingThroughTheLiveDetailRead()
    {
        var id = await SeedOrderWithChildrenAsync(deleted: true);
        await using var context = database.CreateContext();

        var live = await new OrderReader(context, new FixedBusinessCalendar(Now)).GetDetailAsync(id, TestContext.Current.CancellationToken);

        live.ShouldBeNull();
    }

    // One order with two items, a discount, a payment, an expense, a refund and three history rows, deleted by the caller 5 minutes after Now.
    private async Task<Guid> SeedOrderWithChildrenAsync(bool deleted)
    {
        await database.ResetAsync();
        var callerId = Guid.NewGuid();
        var email = $"staff.{callerId:N}@example.com";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = callerId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Mina",
            LastName = "Mercado",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        var today = new DateOnly(2026, 10, 28);
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, today, today.AddDays(14), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m), new NewOrderItem(OrderListSeed.ProductTypes[1].Id, "Jersey short", null, 1, 500.00m)]),
            callerId,
            Now).Value;
        order.AssignNumber("ORD-2026-0001");
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 100.00m, "Loyal customer"), Now).IsFailure.ShouldBeFalse();
        order.AddPayment(new NewOrderPayment(today, 1000.00m, OrderListSeed.PaymentMethods[0].Id, null, null, callerId), today, Now).IsFailure.ShouldBeFalse();
        order.AddExpense(new NewOrderExpense(today, 200.00m, OrderListSeed.OrderExpenseCategories[0].Id, "Fabric", callerId), today, Now).IsFailure.ShouldBeFalse();
        order.ChangeStatus(OrderStatus.Mockup, callerId, Now).IsFailure.ShouldBeFalse();
        order.ChangeStatus(OrderStatus.Cancelled, callerId, Now).IsFailure.ShouldBeFalse();
        order.AddRefund(new NewOrderRefund(today, 300.00m, "Customer changed their mind", callerId), today, Now).IsFailure.ShouldBeFalse();
        if (deleted)
        {
            order.SoftDelete(callerId, Now.AddMinutes(5));
        }

        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return order.Id;
    }

    private async Task<(IReadOnlyList<Guid> Deleted, Guid Live)> SeedAsync()
    {
        await database.ResetAsync();
        var callerId = Guid.NewGuid();
        var email = $"staff.{callerId:N}@example.com";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = callerId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Mina",
            LastName = "Mercado",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        var deleted = new List<Guid>();
        for (var index = 1; index <= DeletedCount + 1; index++)
        {
            var order = Order.Create(
                new NewOrder(
                    new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null),
                    OrderStatus.Pending,
                    [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]),
                callerId,
                Now).Value;
            order.AssignNumber($"ORD-2026-{index:D4}");
            if (index <= DeletedCount)
            {
                order.SoftDelete(callerId, Now.AddMinutes(index));
                deleted.Add(order.Id);
            }

            context.Orders.Add(order);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var liveId = await context.Orders.Where(order => order.DeletedAtUtc == null).Select(order => order.Id).SingleAsync(TestContext.Current.CancellationToken);
        return (deleted, liveId);
    }
}
