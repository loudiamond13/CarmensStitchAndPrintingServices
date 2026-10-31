using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-01, ORD-02, ORD-20, PERF-04: staff list orders by due date with the stored totals, search, filter, sort and page.</summary>
public sealed class ListOrdersEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task StaffListOrdersByDueDateWithTheStoredTotalsAndADeletedOrderIsAbsent()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);

        var late = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        late["dueDate"] = OrderFixtures.Date(today.AddDays(20));
        var lateOrder = await OrderFixtures.CreateAsync(client, admin.AccessToken, late);
        var full = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var soon = OrderFixtures.ValidBody(OrderFixtures.PoloId, today);
        soon["dueDate"] = OrderFixtures.Date(today.AddDays(3));
        var soonOrder = await OrderFixtures.CreateAsync(client, admin.AccessToken, soon);
        var gone = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.PoloId, today));
        using var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, gone.GetProperty("id").GetGuid());
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var page = await OrderFixtures.ReadListAsync(client, admin.AccessToken);

        page.GetProperty("total").GetInt32().ShouldBe(3);
        page.GetProperty("page").GetInt32().ShouldBe(1);
        page.GetProperty("pageSize").GetInt32().ShouldBe(20);
        var items = page.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe(
            [soonOrder.GetProperty("id").GetGuid(), full.GetProperty("id").GetGuid(), lateOrder.GetProperty("id").GetGuid()]);

        var row = items[1];
        row.GetProperty("number").GetString().ShouldBe(full.GetProperty("number").GetString());
        row.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        row.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        row.GetProperty("orderDate").GetString().ShouldBe(OrderFixtures.Date(today));
        row.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(14)));
        row.GetProperty("status").GetString().ShouldBe("pending");
        row.GetProperty("statusChangedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        row.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        row.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        row.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        row.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        row.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        row.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        row.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        row.GetProperty("fullyPaid").GetBoolean().ShouldBeFalse();
        row.EnumerateObject().Select(property => property.Name).ShouldNotContain("contactNumber");
    }

    [Fact]
    public async Task EachRowCarriesItsPiecesAsTheSumOfItsItemQuantities()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync(
            "Forty Pieces",
            items: [OrderFixtures.Item(OrderFixtures.BasketballId, "Jersey top", null, 25, 650.00m), OrderFixtures.Item(OrderFixtures.BasketballId, "Jersey shorts", null, 15, 300.00m)]);
        await rig.NewOrderAsync("One Piece", items: [OrderFixtures.Item(OrderFixtures.PoloId, "Coach polo", "L", 1, 550.00m)]);

        var page = await rig.ReadAsync();

        var pieces = page.GetProperty("items").EnumerateArray().ToDictionary(item => item.GetProperty("customerName").GetString()!, item => item.GetProperty("pieces").GetInt32());
        pieces["Forty Pieces"].ShouldBe(40);
        pieces["One Piece"].ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("status=all")]
    [InlineData("status=completed")]
    [InlineData("q=nobody%20has%20this%20name")]
    [InlineData("hasBalance=true&from=2000-01-01&to=2100-01-01")]
    public async Task TheListWideCountsIgnoreTheFiltersAndNeverCountADeletedOrder(string query)
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Pending Pat");
        var delivered = await rig.NewOrderAsync("Delivered Dan");
        await rig.MoveAsync(delivered, "delivered");
        await rig.NewOrderAsync("Pending Pia");
        var completed = await rig.NewOrderAsync("Completed Cy", free: true);
        await rig.MoveAsync(completed, "completed");
        var gone = await rig.NewOrderAsync("Deleted Dina");
        using var deleted = await OrderFixtures.DeleteAsync(rig.Client, rig.Admin.AccessToken, gone.GetProperty("id").GetGuid());
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var page = await rig.ReadAsync(query);

        page.GetProperty("allOrders").GetInt32().ShouldBe(4);
        page.GetProperty("activeOrders").GetInt32().ShouldBe(3);
    }

    [Fact]
    public async Task TheListCarriesTheBusinessToday()
    {
        await using var rig = await Rig.StartAsync(database);

        var page = await rig.ReadAsync();

        page.GetProperty("today").GetString().ShouldBe(OrderFixtures.Date(rig.Today));
    }

    [Fact]
    public async Task OrdersWithTheSameDueDateComeBackInIdOrder()
    {
        await using var rig = await Rig.StartAsync(database);
        var due = rig.Today.AddDays(9);
        for (var index = 0; index < 4; index++)
        {
            await rig.NewOrderAsync($"Same Due {index}", due: due);
        }

        var page = await rig.ReadAsync("sort=due");

        await using var context = database.CreateContext();
        var expected = await context.Orders.AsNoTracking().OrderBy(order => order.Id).Select(order => order.Id).ToListAsync(TestContext.Current.CancellationToken);
        Ids(page).ShouldBe(expected);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.ListAsync(client, accessToken: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("Dela Cruz", new[] { "Juan Dela Cruz" })]
    [InlineData("dela cruz", new[] { "Juan Dela Cruz" })]
    [InlineData("Riders", new[] { "Maria Santos" })]
    [InlineData("0928", new[] { "Maria Santos" })]
    [InlineData("100%_", new[] { "Ana 100%_ Lopez" })]
    [InlineData("%", new[] { "Ana 100%_ Lopez" })]
    [InlineData("_", new[] { "Ana 100%_ Lopez" })]
    [InlineData("[", new string[0])]
    [InlineData("nobody at all", new string[0])]
    public async Task SearchFindsTheCustomerTeamAndContactNumberAndKeepsTypedWildcardsLiteral(string q, string[] expected)
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567");
        await rig.NewOrderAsync("Maria Santos", "Riders Club", "0928 555 0100");
        await rig.NewOrderAsync("Ana 100%_ Lopez", null, "0999 000 1111");

        var page = await rig.ReadAsync($"q={Uri.EscapeDataString(q)}");

        Names(page).Order(StringComparer.Ordinal).ShouldBe(expected.Order(StringComparer.Ordinal));
        page.GetProperty("total").GetInt32().ShouldBe(expected.Length);
    }

    [Fact]
    public async Task SearchFindsAnOrderByItsNumberOrByTheYearPartOfEveryNumber()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Juan Dela Cruz");
        var second = await rig.NewOrderAsync("Maria Santos");
        var number = second.GetProperty("number").GetString()!;

        var one = await rig.ReadAsync($"q={Uri.EscapeDataString(number)}");
        var all = await rig.ReadAsync("q=ORD-2026");

        Names(one).ShouldBe(["Maria Santos"]);
        all.GetProperty("total").GetInt32().ShouldBe(2);
    }

    [Fact]
    public async Task ABlankSearchIsNoSearch()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Juan Dela Cruz");
        await rig.NewOrderAsync("Maria Santos");

        var page = await rig.ReadAsync("q=%20%20");

        page.GetProperty("total").GetInt32().ShouldBe(2);
    }

    [Fact]
    public async Task ActiveKeepsRecentEndStatesAndDropsOldOnesAndAllAndOneStatusDiffer()
    {
        await using var rig = await Rig.StartAsync(database);
        var now = TimeProvider.System.GetUtcNow();
        await rig.NewOrderAsync("Pending Pat");
        var delivered = await rig.NewOrderAsync("Delivered Dan");
        await rig.MoveAsync(delivered, "delivered");
        var oldCompleted = await rig.NewOrderAsync("Old Completed Olga", free: true);
        await rig.MoveAsync(oldCompleted, "completed");
        await rig.SetStatusChangedAsync(oldCompleted, now.AddDays(-31));
        var newCompleted = await rig.NewOrderAsync("New Completed Nico", free: true);
        await rig.MoveAsync(newCompleted, "completed");
        await rig.SetStatusChangedAsync(newCompleted, now.AddDays(-29));
        var cancelled = await rig.NewOrderAsync("Cancelled Cleo");
        await rig.MoveAsync(cancelled, "cancelled");
        var oldCancelled = await rig.NewOrderAsync("Old Cancelled Ora");
        await rig.MoveAsync(oldCancelled, "cancelled");
        await rig.SetStatusChangedAsync(oldCancelled, now.AddDays(-45));

        var active = await rig.ReadAsync();
        var explicitActive = await rig.ReadAsync("status=active");
        var all = await rig.ReadAsync("status=all");
        var onlyDelivered = await rig.ReadAsync("status=delivered");
        var completed = await rig.ReadAsync("status=Completed");
        var cancelledOnly = await rig.ReadAsync("status=cancelled");

        Names(active).Order(StringComparer.Ordinal).ShouldBe(["Cancelled Cleo", "Delivered Dan", "New Completed Nico", "Pending Pat"]);
        Names(explicitActive).Order(StringComparer.Ordinal).ShouldBe(Names(active).Order(StringComparer.Ordinal));
        all.GetProperty("total").GetInt32().ShouldBe(6);
        Names(onlyDelivered).ShouldBe(["Delivered Dan"]);
        Names(completed).Order(StringComparer.Ordinal).ShouldBe(["New Completed Nico", "Old Completed Olga"]);
        Names(cancelledOnly).Order(StringComparer.Ordinal).ShouldBe(["Cancelled Cleo", "Old Cancelled Ora"]);
    }

    [Fact]
    public async Task FromAndToKeepOrdersByTheirOrderDateEdgesIncluded()
    {
        await using var rig = await Rig.StartAsync(database);
        var today = rig.Today;
        await rig.NewOrderAsync("Ten Days Ago", orderDate: today.AddDays(-10));
        await rig.NewOrderAsync("Five Days Ago", orderDate: today.AddDays(-5));
        await rig.NewOrderAsync("Today", orderDate: today);

        var between = await rig.ReadAsync($"from={OrderFixtures.Date(today.AddDays(-10))}&to={OrderFixtures.Date(today.AddDays(-5))}");
        var fromOnly = await rig.ReadAsync($"from={OrderFixtures.Date(today.AddDays(-5))}");
        var toOnly = await rig.ReadAsync($"to={OrderFixtures.Date(today.AddDays(-6))}");
        var exact = await rig.ReadAsync($"from={OrderFixtures.Date(today)}&to={OrderFixtures.Date(today)}");

        Names(between).Order(StringComparer.Ordinal).ShouldBe(["Five Days Ago", "Ten Days Ago"]);
        Names(fromOnly).Order(StringComparer.Ordinal).ShouldBe(["Five Days Ago", "Today"]);
        Names(toOnly).ShouldBe(["Ten Days Ago"]);
        Names(exact).ShouldBe(["Today"]);
    }

    [Fact]
    public async Task ProductTypeKeepsOrdersWithAtLeastOneItemOfThatTypeOnceEach()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Jerseys Only", items: [OrderFixtures.Item(OrderFixtures.BasketballId)]);
        await rig.NewOrderAsync("One Polo", items: [OrderFixtures.Item(OrderFixtures.PoloId)]);
        await rig.NewOrderAsync(
            "Two Polos And A Jersey",
            items:
            [
                OrderFixtures.Item(OrderFixtures.BasketballId),
                OrderFixtures.Item(OrderFixtures.PoloId, "Coach polo"),
                OrderFixtures.Item(OrderFixtures.PoloId, "Staff polo"),
            ]);

        var polo = await rig.ReadAsync($"productType={OrderFixtures.PoloId:D}");
        var banner = await rig.ReadAsync($"productType={OrderFixtures.CustomDesignId:D}");

        Names(polo).Order(StringComparer.Ordinal).ShouldBe(["One Polo", "Two Polos And A Jersey"]);
        polo.GetProperty("total").GetInt32().ShouldBe(2);
        banner.GetProperty("total").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task ADeletedOrderIsNotListedOrCountedByTheProductTypeFilter()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Kept Polo", items: [OrderFixtures.Item(OrderFixtures.PoloId)]);
        var gone = await rig.NewOrderAsync("Deleted Polo", items: [OrderFixtures.Item(OrderFixtures.PoloId)]);
        using var deleted = await OrderFixtures.DeleteAsync(rig.Client, rig.Admin.AccessToken, gone.GetProperty("id").GetGuid());
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var polo = await rig.ReadAsync($"productType={OrderFixtures.PoloId:D}");

        Names(polo).ShouldBe(["Kept Polo"]);
        polo.GetProperty("total").GetInt32().ShouldBe(1);
    }

    [Fact]
    public async Task HasBalanceTrueDropsOrdersThatOweNothingAndFalseOrNothingKeepsAll()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Owes Money");
        await rig.NewOrderAsync("Owes Nothing", free: true);

        var owing = await rig.ReadAsync("hasBalance=true");
        var notFiltered = await rig.ReadAsync("hasBalance=false");
        var none = await rig.ReadAsync();

        Names(owing).ShouldBe(["Owes Money"]);
        notFiltered.GetProperty("total").GetInt32().ShouldBe(2);
        none.GetProperty("total").GetInt32().ShouldBe(2);
    }

    [Fact]
    public async Task DueSortIsSoonestFirstWithNoDueDateLast()
    {
        await using var rig = await Rig.StartAsync(database);
        var today = rig.Today;
        await rig.NewOrderAsync("Due Late", due: today.AddDays(30));
        var none = await rig.NewOrderAsync("No Due Date", due: today.AddDays(5));
        await rig.NewOrderAsync("Due Soon", due: today.AddDays(2));
        await rig.ClearDueDateAsync(none);

        var byDefault = await rig.ReadAsync();
        var explicitDue = await rig.ReadAsync("sort=due");

        Names(byDefault).ShouldBe(["Due Soon", "Due Late", "No Due Date"]);
        Names(explicitDue).ShouldBe(["Due Soon", "Due Late", "No Due Date"]);
    }

    [Fact]
    public async Task NewestSortIsLatestOrderDateFirst()
    {
        await using var rig = await Rig.StartAsync(database);
        var today = rig.Today;
        await rig.NewOrderAsync("Middle", orderDate: today.AddDays(-5));
        await rig.NewOrderAsync("Oldest", orderDate: today.AddDays(-9));
        await rig.NewOrderAsync("Newest", orderDate: today);

        var page = await rig.ReadAsync("sort=newest");

        Names(page).ShouldBe(["Newest", "Middle", "Oldest"]);
    }

    [Fact]
    public async Task BalanceAndTotalSortsPutTheLargestFirstAndTheyDiffer()
    {
        await using var rig = await Rig.StartAsync(database);
        var bigPaid = await rig.NewOrderAsync("Big And Mostly Paid", items: [OrderFixtures.Item(OrderFixtures.BasketballId, "Jersey", null, 10, 1000.00m)]);
        await rig.PayAsync(bigPaid, 9000.00m);
        await rig.NewOrderAsync("Small And Unpaid", items: [OrderFixtures.Item(OrderFixtures.PoloId, "Polo", null, 1, 3000.00m)]);
        await rig.NewOrderAsync("Medium", items: [OrderFixtures.Item(OrderFixtures.PoloId, "Polo", null, 1, 5000.00m)]);

        var byBalance = await rig.ReadAsync("sort=balance");
        var byTotal = await rig.ReadAsync("sort=total");

        Names(byBalance).ShouldBe(["Medium", "Small And Unpaid", "Big And Mostly Paid"]);
        Names(byTotal).ShouldBe(["Big And Mostly Paid", "Medium", "Small And Unpaid"]);
    }

    [Theory]
    [InlineData("due")]
    [InlineData("newest")]
    [InlineData("balance")]
    [InlineData("total")]
    public async Task TiesAreBrokenByIdSoPagesAreStableAndDoNotOverlap(string sort)
    {
        await using var rig = await Rig.StartAsync(database);
        for (var index = 0; index < 5; index++)
        {
            await rig.NewOrderAsync($"Same Figures {index}");
        }

        var whole = await rig.ReadAsync($"sort={sort}&pageSize=5");
        var wholeIds = Ids(whole);
        var pieces = new List<Guid>();
        for (var number = 1; number <= 5; number++)
        {
            var piece = await rig.ReadAsync($"sort={sort}&pageSize=1&page={number}");
            piece.GetProperty("total").GetInt32().ShouldBe(5);
            pieces.AddRange(Ids(piece));
        }

        wholeIds.Distinct().Count().ShouldBe(5);
        pieces.ShouldBe(wholeIds);
    }

    [Fact]
    public async Task PageTwoOfPageSizeOneIsTheSecondRowAndTheTotalStays()
    {
        await using var rig = await Rig.StartAsync(database);
        var today = rig.Today;
        await rig.NewOrderAsync("First Due", due: today.AddDays(1));
        await rig.NewOrderAsync("Second Due", due: today.AddDays(2));
        await rig.NewOrderAsync("Third Due", due: today.AddDays(3));

        var page = await rig.ReadAsync("pageSize=1&page=2");
        var past = await rig.ReadAsync("pageSize=1&page=4");

        Names(page).ShouldBe(["Second Due"]);
        page.GetProperty("total").GetInt32().ShouldBe(3);
        page.GetProperty("page").GetInt32().ShouldBe(2);
        page.GetProperty("pageSize").GetInt32().ShouldBe(1);
        past.GetProperty("items").GetArrayLength().ShouldBe(0);
        past.GetProperty("total").GetInt32().ShouldBe(3);
    }

    [Fact]
    public async Task ADeletedOrderIsNotListedCountedOrFound()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.NewOrderAsync("Kept Kim");
        var gone = await rig.NewOrderAsync("Deleted Dina");
        using var deleted = await OrderFixtures.DeleteAsync(rig.Client, rig.Admin.AccessToken, gone.GetProperty("id").GetGuid());
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var all = await rig.ReadAsync("status=all");
        var search = await rig.ReadAsync("q=Deleted");

        Names(all).ShouldBe(["Kept Kim"]);
        all.GetProperty("total").GetInt32().ShouldBe(1);
        search.GetProperty("total").GetInt32().ShouldBe(0);
    }

    [Theory]
    [InlineData("status=shipped", "status", "Choose a status.")]
    [InlineData("sort=price", "sort", "Choose a sort order.")]
    [InlineData("from=2026-13-01", "from", "Enter a real date.")]
    [InlineData("to=not-a-date", "to", "Enter a real date.")]
    [InlineData("from=2026-10-28&to=2026-10-27", "to", "The end date can't be before the start date.")]
    [InlineData("pageSize=0", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("pageSize=101", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("page=0", "page", "Use a page from 1 to 100000.")]
    [InlineData("page=100001", "page", "Use a page from 1 to 100000.")]
    [InlineData("productType=polo", "productType", "Choose a product type.")]
    public async Task BadInputIs400WithAPlainEnglishFieldError(string query, string field, string message)
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await OrderFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, query);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, field).ShouldBe([message]);
    }

    [Fact]
    public async Task ASearchOfOneHundredAndOneCharactersIs400AndOneHundredIsAccepted()
    {
        await using var rig = await Rig.StartAsync(database);

        using var refused = await OrderFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, $"q={new string('a', 101)}");
        using var accepted = await OrderFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, $"q={new string('a', 100)}");

        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken), "q").ShouldBe(["Use 100 characters or fewer."]);
        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static IReadOnlyList<string> Names(JsonElement page) =>
        [.. page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("customerName").GetString()!)];

    private static List<Guid> Ids(JsonElement page) =>
        [.. page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid())];

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _factory;
        private readonly CspsDatabase _database;

        private Rig(CspsApiFactory factory, CspsDatabase db, StartedSession admin, DateOnly today)
        {
            _factory = factory;
            _database = db;
            Client = factory.CreateClient();
            Admin = admin;
            Today = today;
        }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public DateOnly Today { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            try
            {
                var admin = await TestSessions.StartAsync(factory, Roles.Admin);
                var today = await OrderFixtures.TodayAsync(factory);
                return new Rig(factory, database, admin, today);
            }
            catch
            {
                await factory.DisposeAsync();
                throw;
            }
        }

        public Task<JsonElement> ReadAsync(string? query = null) => OrderFixtures.ReadListAsync(Client, Admin.AccessToken, query);

        // One jersey line of 15 at 650.00 unless items are given; free makes a single 0.00 line so the balance is exactly 0.00.
        public Task<JsonElement> NewOrderAsync(
            string customer,
            string? team = null,
            string contact = "0917 123 4567",
            DateOnly? orderDate = null,
            DateOnly? due = null,
            bool free = false,
            IReadOnlyList<Dictionary<string, object?>>? items = null)
        {
            var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, Today);
            body["customerName"] = customer;
            body["teamName"] = team;
            body["contactNumber"] = contact;
            var placed = orderDate ?? Today;
            body["orderDate"] = OrderFixtures.Date(placed);
            body["dueDate"] = OrderFixtures.Date(due ?? placed.AddDays(14));
            if (free)
            {
                body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId, "Free sample", null, 1, 0.00m) };
            }
            else if (items is not null)
            {
                body["items"] = items;
            }

            return OrderFixtures.CreateAsync(Client, Admin.AccessToken, body);
        }

        public async Task MoveAsync(JsonElement order, string status) =>
            await OrderFixtures.ChangeStatusAndReadAsync(Client, Admin.AccessToken, order.GetProperty("id").GetGuid(), status);

        public Task<JsonElement> PayAsync(JsonElement order, decimal amount) =>
            OrderFixtures.AddPaymentAndReadAsync(Client, Admin.AccessToken, order, Today, amount, OrderFixtures.CashId, Admin.UserId);

        public async Task SetStatusChangedAsync(JsonElement order, DateTimeOffset at)
        {
            var id = order.GetProperty("id").GetGuid();
            await using var context = _database.CreateContext();
            await context.Orders.Where(row => row.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.StatusChangedAtUtc, at), TestContext.Current.CancellationToken);
        }

        public async Task ClearDueDateAsync(JsonElement order)
        {
            var id = order.GetProperty("id").GetGuid();
            await using var context = _database.CreateContext();
            await context.Orders.Where(row => row.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.DueDate, (DateOnly?)null), TestContext.Current.CancellationToken);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
        }
    }
}
