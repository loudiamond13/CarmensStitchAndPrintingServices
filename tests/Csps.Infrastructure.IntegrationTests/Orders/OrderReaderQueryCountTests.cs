using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>PERF-04, ORD-01, ORD-02: the order list runs exactly three SQL commands whatever the page size and whichever filter or sort is on.</summary>
public sealed class OrderReaderQueryCountTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int OrderCount = 150;
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid PoloId = OrderListSeed.ProductTypes.Single(row => row.Name == "Polo Shirt").Id;
    private static readonly Guid JerseyId = OrderListSeed.ProductTypes.Single(row => row.Name == "Basketball Jersey").Id;

    public static TheoryData<string, int> Cases()
    {
        var data = new TheoryData<string, int>();
        foreach (var filter in new[] { "none", "search", "status-all", "status-one", "dates", "product-type", "has-balance", "sort-newest", "sort-balance", "sort-total", "everything" })
        {
            foreach (var pageSize in new[] { 1, 20, 100 })
            {
                data.Add(filter, pageSize);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task EveryFilterAndSortRunsExactlyThreeCommandsAtEveryPageSize(string filter, int pageSize)
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListAsync(QueryFor(filter, pageSize), Now, TestContext.Current.CancellationToken);

        // Count, page and the two list-wide counts: 3 fixed commands (D-60, owner, 2026-10-29).
        counter.Count.ShouldBe(3, string.Join(Environment.NewLine, counter.Commands));
        page.Items.Count.ShouldBe(Math.Min(pageSize, page.Total));
        page.Total.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task AnEmptyResultStillRunsExactlyThreeCommands()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var query = QueryFor("none", 20) with { Search = "nobody has this name" };

        counter.Reset();
        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListAsync(query, Now, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(3, string.Join(Environment.NewLine, counter.Commands));
        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
        page.AllOrders.ShouldBe(OrderCount);
    }

    [Theory]
    [InlineData("none")]
    [InlineData("search")]
    [InlineData("status-one")]
    [InlineData("everything")]
    public async Task EveryRowCarriesItsPiecesAndTheListWideCountsIgnoreEveryFilter(string filter)
    {
        await SeedAsync();
        await using var context = database.CreateContext();

        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListAsync(QueryFor(filter, 100), Now, TestContext.Current.CancellationToken);

        page.AllOrders.ShouldBe(OrderCount);
        page.ActiveOrders.ShouldBe(OrderCount);
        page.Items.ShouldNotBeEmpty();
        page.Items.ShouldAllBe(row => row.Pieces == 2 || row.Pieces == 4);
    }

    [Fact]
    public async Task TheListWideCountsLeaveOutDeletedOrdersAndTheEndStatuses()
    {
        await SeedAsync();
        await using (var edit = database.CreateContext())
        {
            var ids = await edit.Orders.OrderBy(order => order.Number).Select(order => order.Id).Take(5).ToListAsync(TestContext.Current.CancellationToken);
            await edit.Orders.Where(order => order.Id == ids[0]).ExecuteUpdateAsync(set => set.SetProperty(order => order.DeletedAtUtc, Now), TestContext.Current.CancellationToken);
            await edit.Orders.Where(order => order.Id == ids[1]).ExecuteUpdateAsync(set => set.SetProperty(order => order.Status, OrderStatus.Completed), TestContext.Current.CancellationToken);
            await edit.Orders.Where(order => order.Id == ids[2]).ExecuteUpdateAsync(set => set.SetProperty(order => order.Status, OrderStatus.Cancelled), TestContext.Current.CancellationToken);
            await edit.Orders.Where(order => order.Id == ids[3]).ExecuteUpdateAsync(set => set.SetProperty(order => order.Status, OrderStatus.Delivered), TestContext.Current.CancellationToken);
            await edit.Orders.Where(order => order.Id == ids[4]).ExecuteUpdateAsync(set => set.SetProperty(order => order.Status, OrderStatus.Mockup), TestContext.Current.CancellationToken);
        }

        await using var context = database.CreateContext();
        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListAsync(QueryFor("status-one", 20), Now, TestContext.Current.CancellationToken);

        page.AllOrders.ShouldBe(OrderCount - 1);
        page.ActiveOrders.ShouldBe(OrderCount - 3);
    }

    [Fact]
    public async Task AProductTypeFilterListsEachOrderOnceHoweverManyMatchingItemsItHas()
    {
        await SeedAsync();
        await using var context = database.CreateContext();

        var page = await new OrderReader(context, new FixedBusinessCalendar(Now)).ListAsync(QueryFor("product-type", 100), Now, TestContext.Current.CancellationToken);

        page.Items.Select(row => row.Id).Distinct().Count().ShouldBe(page.Items.Count);
        page.Total.ShouldBe(OrderCount / 3 * 2);
    }

    private static OrderListQuery QueryFor(string filter, int pageSize)
    {
        var all = new OrderListQuery(null, OrderListScope.All, null, null, null, null, false, OrderListSort.Due, 1, pageSize);
        return filter switch
        {
            "search" => all with { Search = "Dela Cruz" },
            "status-all" => all,
            "status-one" => all with { Scope = OrderListScope.One, Status = OrderStatus.Pending },
            "dates" => all with { From = Today.AddDays(-5), To = Today },
            "product-type" => all with { ProductTypeId = PoloId },
            "has-balance" => all with { HasBalance = true },
            "sort-newest" => all with { Sort = OrderListSort.Newest },
            "sort-balance" => all with { Sort = OrderListSort.Balance },
            "sort-total" => all with { Sort = OrderListSort.Total },
            "everything" => new OrderListQuery("Dela", OrderListScope.One, OrderStatus.Pending, Today.AddDays(-30), Today, JerseyId, true, OrderListSort.Total, 1, pageSize),
            _ => all with { Scope = OrderListScope.Active },
        };
    }

    // 150 live pending orders on 10 days: every third has a jersey only, the others a jersey and two polo lines.
    private async Task SeedAsync()
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
        for (var index = 1; index <= OrderCount; index++)
        {
            List<NewOrderItem> items = [new(JerseyId, "Jersey top", null, 2, 650.00m)];
            if (index % 3 != 0)
            {
                items.Add(new NewOrderItem(PoloId, "Coach polo", "L", 1, 550.00m));
                items.Add(new NewOrderItem(PoloId, "Staff polo", "M", 1, 500.00m));
            }

            var date = Today.AddDays(-(index % 10));
            var order = Order.Create(
                new NewOrder(new OrderDetails("Juan Dela Cruz", "Ballers", "0917 123 4567", null, null, date, date.AddDays(14), null), OrderStatus.Pending, items),
                callerId,
                Now).Value;
            order.AssignNumber($"ORD-2026-{index:D4}");
            context.Orders.Add(order);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
