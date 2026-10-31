using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>PERF-04, D-28: the deleted-order list runs two SQL commands whatever the page size, newest deletion first, live orders never listed.</summary>
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
        var page = await new OrderReader(context).ListDeletedAsync(1, pageSize, TestContext.Current.CancellationToken);

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
        var page = await new OrderReader(context).ListDeletedAsync(1, 20, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
    }

    [Fact]
    public async Task TheListHoldsOnlyDeletedOrdersNewestDeletionFirstAndPagesDoNotOverlap()
    {
        var (deletedIds, liveId) = await SeedAsync();
        await using var context = database.CreateContext();
        var reader = new OrderReader(context);

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
