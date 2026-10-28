using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-03, ORD-14, ORD-16, ORD-20, D-23: a staff member creates an order and reads it back; a stranger is refused.</summary>
public sealed class CreateOrderEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminCreatesAnOrderAndGets201WithTheNumberItemsTotalsAndFirstHistoryRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var body = document.RootElement;
        var id = body.GetProperty("id").GetGuid();
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/orders/{id:D}");
        body.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
        body.GetProperty("status").GetString().ShouldBe("pending");
        body.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        body.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        body.GetProperty("contactNumber").GetString().ShouldBe("0917 123 4567");
        body.GetProperty("email").GetString().ShouldBe("juan.dc@example.com");
        OrderFixtures.IsNull(body, "address").ShouldBeTrue();
        OrderFixtures.IsNull(body, "notes").ShouldBeTrue();
        body.GetProperty("orderDate").GetString().ShouldBe(OrderFixtures.Date(today));
        body.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(14)));

        var item = body.GetProperty("items").EnumerateArray().Single();
        item.GetProperty("description").GetString().ShouldBe("Jersey top");
        item.GetProperty("sizeVariant").GetString().ShouldBe("S-XL");
        item.GetProperty("quantity").GetInt32().ShouldBe(15);
        item.GetProperty("unitPrice").GetDecimal().ShouldBe(650.00m);
        item.GetProperty("lineTotal").GetDecimal().ShouldBe(9750.00m);
        var productType = item.GetProperty("productType");
        productType.GetProperty("id").GetGuid().ShouldBe(OrderFixtures.BasketballId);
        productType.GetProperty("name").GetString().ShouldBe("Basketball Jersey");
        productType.GetProperty("tone").GetString().ShouldNotBeNullOrWhiteSpace();
        productType.GetProperty("retired").GetBoolean().ShouldBeFalse();

        var totals = body.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("total").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("fullyPaid").GetBoolean().ShouldBeFalse();

        var history = body.GetProperty("statusHistory").EnumerateArray().Single();
        OrderFixtures.IsNull(history, "from").ShouldBeTrue();
        history.GetProperty("to").GetString().ShouldBe("pending");
        history.GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        history.GetProperty("changedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));

        body.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        OrderFixtures.IsNull(body, "lastChangedBy").ShouldBeTrue();
        body.GetProperty("version").GetString().ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task ASecondCreateGetsTheNextNumber()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        var first = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        first.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
        second.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0002");
    }

    [Fact]
    public async Task AManagerReadsTheSameOrderById()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());

        read.GetRawText().ShouldBe(created.GetRawText());
    }

    [Fact]
    public async Task AnUnknownIdIs404WithTheNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await OrderFixtures.GetAsync(client, admin.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.PostAsync(client, accessToken: null, OrderFixtures.ValidBody(OrderFixtures.BasketballId, new DateOnly(2026, 10, 28)));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnAnonymousGetGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.GetAsync(client, accessToken: null, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task APostWithNoBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.invalid-request");
    }

    [Fact]
    public async Task TheFiveItemsOfOrderZeroOneFourEightGiveAnExactSubtotalAndTheOtherFigures()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148ItemsBody(today));

        var totals = created.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("total").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("fullyPaid").GetBoolean().ShouldBeFalse();
        created.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("lineTotal").GetDecimal())
            .ShouldBe([9750.00m, 4500.00m, 1100.00m, 6300.00m, 800.00m]);
    }

    [Fact]
    public async Task AProductTypeMarkedRetiredInTheDatabaseIsRefusedOnTheItemPath()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        await SetRetiredAsync(OrderFixtures.PoloId, retired: true);
        try
        {
            var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
            body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId), OrderFixtures.Item(OrderFixtures.PoloId) };

            using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.invalid-request");
            OrderFixtures.ErrorFields(problem).ShouldBe(["items[1].productTypeId"]);
            OrderFixtures.FieldErrors(problem, "items[1].productTypeId").ShouldBe(["This product type was retired. Choose another one."]);
        }
        finally
        {
            await SetRetiredAsync(OrderFixtures.PoloId, retired: false);
        }
    }

    [Fact]
    public async Task AnUnknownProductTypeIsRefusedOnTheItemPath()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, OrderFixtures.ValidBody(Guid.NewGuid(), today));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "items[0].productTypeId").ShouldBe(["Choose a product type."]);
    }

    [Fact]
    public async Task ADueDateBeforeTheOrderDateIsRefusedOnTheDueDateField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["dueDate"] = OrderFixtures.Date(today.AddDays(-1));

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["dueDate"]);
        OrderFixtures.FieldErrors(problem, "dueDate").ShouldBe(["The due date can't be before the order date."]);
    }

    [Theory]
    [InlineData("completed")]
    [InlineData("cancelled")]
    public async Task ACreateAsCompletedOrCancelledIsRefusedOnTheStatusField(string status)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["status"] = status;

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "status").ShouldBe(["Create the order first, then complete or cancel it."]);
    }

    [Fact]
    public async Task ADeliveredStatusIsAcceptedAndShownInTheDetailAndTheFirstHistoryRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["status"] = "delivered";

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        created.GetProperty("status").GetString().ShouldBe("delivered");
        created.GetProperty("statusHistory").EnumerateArray().Single().GetProperty("to").GetString().ShouldBe("delivered");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(10_000, true)]
    [InlineData(10_001, false)]
    public async Task TheQuantityLimitsHoldAtTheirEdges(int quantity, bool accepted)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId, quantity: quantity, unitPrice: 1.00m) };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
        if (!accepted)
        {
            OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "items[0].quantity")
                .ShouldBe(["Enter a quantity from 1 to 10,000."]);
        }
    }

    [Theory]
    [InlineData("0.00", true)]
    [InlineData("1000000.00", true)]
    [InlineData("1000000.01", false)]
    [InlineData("650.123", false)]
    public async Task TheUnitPriceLimitsHoldAtTheirEdges(string price, bool accepted)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId, quantity: 1, unitPrice: decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture)) };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
        if (!accepted)
        {
            OrderFixtures.ErrorFields(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).ShouldBe(["items[0].unitPrice"]);
        }
    }

    [Theory]
    [InlineData(100, true)]
    [InlineData(101, false)]
    public async Task TheItemCountLimitHoldsAtItsEdge(int count, bool accepted)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = Enumerable.Range(0, count).Select(_ => OrderFixtures.Item(OrderFixtures.BasketballId, quantity: 1, unitPrice: 1.00m)).ToArray();

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
        if (accepted)
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            document.RootElement.GetProperty("items").GetArrayLength().ShouldBe(100);
        }
        else
        {
            OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "items").ShouldBe(["An order can have at most 100 items."]);
        }
    }

    [Theory]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public async Task TheDescriptionLimitHoldsAtItsEdge(int length, bool accepted)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId, description: new string('d', length)) };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
        if (!accepted)
        {
            OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "items[0].description")
                .ShouldBe(["Keep the description to 200 characters or fewer."]);
        }
    }

    [Fact]
    public async Task ADueDateEqualToTheOrderDateIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["dueDate"] = OrderFixtures.Date(today);

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        created.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today));
    }

    [Fact]
    public async Task ManyBrokenFieldsComeBackInOneBadRequestWithNestedPaths()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["customerName"] = " ";
        body["items"] = new[]
        {
            OrderFixtures.Item(OrderFixtures.BasketballId),
            OrderFixtures.Item(OrderFixtures.BasketballId, quantity: 0),
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.ErrorFields(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).ShouldBe(["customerName", "items[1].quantity"]);
    }

    [Fact]
    public async Task TheSameKeyAndBodyTwiceGiveTwoIdentical201sOneOrderOneNumberAndOneAuditRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["customerName"] = $"Idem {Guid.NewGuid():N}";
        var key = Guid.NewGuid();

        using var first = await OrderFixtures.PostAsync(client, admin.AccessToken, body, key);
        using var second = await OrderFixtures.PostAsync(client, admin.AccessToken, body, key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        var firstText = await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe(firstText);
        var id = JsonDocument.Parse(firstText).RootElement.GetProperty("id").GetGuid();

        await using var context = database.CreateContext();
        (await context.Orders.CountAsync(order => order.CustomerName == (string)body["customerName"]!, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.OrderNumberCounters.SingleAsync(TestContext.Current.CancellationToken)).LastValue.ShouldBe(1);
        (await context.AuditLog.CountAsync(row => row.Action == "order.created" && row.TargetId == id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task EveryCreateLeavesOneAuditEntryWithTheNumberStatusDatesItemCountAndTotalButNoCustomerText()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["notes"] = "Private rush note";

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        var id = created.GetProperty("id").GetGuid().ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.Action == "order.created" && row.TargetId == id, TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("Order");
        entry.ActorUserId.ShouldBe(admin.UserId);
        entry.Detail.ShouldBe($"number=ORD-{today.Year}-0001;status=pending;orderDate={OrderFixtures.Date(today)};dueDate={OrderFixtures.Date(today.AddDays(14))};items=1;total=9750.00");
        foreach (var secret in new[] { "Juan", "Ballers", "0917", "juan.dc", "Private", "Jersey top" })
        {
            entry.Detail.ShouldNotBeNull().ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public async Task APostWithoutAnIdempotencyKeyIsRefusedByTheGateAndCreatesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["customerName"] = $"NoKey {Guid.NewGuid():N}";

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body, withKey: false);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
        await using var context = database.CreateContext();
        (await context.Orders.CountAsync(order => order.CustomerName == (string)body["customerName"]!, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheOrd0148ItemsWithTheFivePercentLeagueDiscountInTheBodyGive21327()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.Ord0148ItemsBody(today);
        body["discounts"] = new[] { new Dictionary<string, object?> { ["kind"] = "percentage", ["value"] = 5m, ["reason"] = "Barangay league discount" } };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var created = document.RootElement;
        var discount = created.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem();
        discount.GetProperty("kind").GetString().ShouldBe("percentage");
        discount.GetProperty("value").GetDecimal().ShouldBe(5.00m);
        discount.GetProperty("reason").GetString().ShouldBe("Barangay league discount");
        discount.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var totals = created.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        var read = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, created.GetProperty("id").GetGuid());
        read.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.Set<Csps.Domain.Orders.OrderDiscount>().CountAsync(row => row.OrderId == created.GetProperty("id").GetGuid(), TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheOrd0148BodyWithItsDiscountAndBothPaymentsGivesPaid12000AndBalance9327()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.Ord0148ItemsBody(today);
        body["discounts"] = new[] { new Dictionary<string, object?> { ["kind"] = "percentage", ["value"] = 5m, ["reason"] = "Barangay league discount" } };
        body["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today.AddDays(-3), 10000.00m, OrderFixtures.GCashId, admin.UserId, "9012 345 678901", "50% downpayment"),
            OrderFixtures.PaymentItem(today.AddDays(-1), 2000.00m, OrderFixtures.CashId, manager.UserId, null, null),
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var created = document.RootElement;
        var totals = created.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        var payments = created.GetProperty("payments").EnumerateArray().ToList();
        payments.Count.ShouldBe(2);
        payments[0].GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        payments[1].GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        payments[1].GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var id = created.GetProperty("id").GetGuid();
        await using var context = database.CreateContext();
        (await context.Set<Csps.Domain.Orders.OrderPayment>().CountAsync(row => row.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    [Fact]
    public async Task PaymentsInTheBodyThatPassTheTotalAreA400OnPaymentsAndNoOrderIsCreated()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var bad = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        bad["customerName"] = $"Overpaid {Guid.NewGuid():N}";
        bad["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today, 9_000m, OrderFixtures.CashId, admin.UserId, null, null),
            OrderFixtures.PaymentItem(today, 750.01m, OrderFixtures.CashId, admin.UserId, null, null),
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, bad);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "payments").ShouldBe(["The payments would be more than the order total. Lower a payment first."]);
        await using var context = database.CreateContext();
        (await context.Orders.CountAsync(order => order.CustomerName == (string)bad["customerName"]!, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task APaymentWithAnIneligibleReceiverInTheBodyIsListedOnItsIndexedPath()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, admin.UserId, null, null),
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, Csps.Domain.Identity.LegacyHolder.Id, null, null),
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["payments[1].receivedByUserId"]);
        OrderFixtures.FieldErrors(problem, "payments[1].receivedByUserId")
            .ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
    }

    [Fact]
    public async Task ARetiredMethodAndAFutureDateInTheBodyAreListedOnTheirIndexedPaths()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var retiredMethod = await OrderFixtures.AddPaymentMethodAsync(database, retired: true);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today, 100m, retiredMethod, admin.UserId, null, null),
            OrderFixtures.PaymentItem(today.AddDays(1), 100m, OrderFixtures.CashId, admin.UserId, null, null),
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["payments[0].paymentMethodId", "payments[1].paymentDate"]);
        OrderFixtures.FieldErrors(problem, "payments[0].paymentMethodId").ShouldBe(["This payment method was retired. Choose another one."]);
    }

    [Fact]
    public async Task DiscountsInTheBodyThatPassTheItemsTotalAreA400OnDiscountsAndNoNumberIsUsed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var bad = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        bad["customerName"] = $"TooMuch {Guid.NewGuid():N}";
        bad["discounts"] = new[] { new Dictionary<string, object?> { ["kind"] = "fixed", ["value"] = 9_750.01m, ["reason"] = "Too big" } };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, bad);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "discounts").ShouldBe(["The discounts would be more than the items total. Lower or remove a discount first."]);
        await using (var context = database.CreateContext())
        {
            (await context.Orders.CountAsync(order => order.CustomerName == (string)bad["customerName"]!, TestContext.Current.CancellationToken)).ShouldBe(0);
        }

        var next = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var firstNumber = first.GetProperty("number").GetString()!;
        var nextNumber = next.GetProperty("number").GetString()!;
        var prefix = firstNumber[..firstNumber.LastIndexOf('-')];
        nextNumber.ShouldBe($"{prefix}-{int.Parse(firstNumber[(firstNumber.LastIndexOf('-') + 1)..], System.Globalization.CultureInfo.InvariantCulture) + 1:0000}");
    }

    [Fact]
    public async Task ADiscountErrorInTheBodyIsListedOnItsPathWithTheOtherFieldErrors()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["customerName"] = string.Empty;
        body["discounts"] = new[]
        {
            new Dictionary<string, object?> { ["kind"] = "fixed", ["value"] = 100m, ["reason"] = "League" },
            new Dictionary<string, object?> { ["kind"] = "percentage", ["value"] = 0m, ["reason"] = " " },
        };

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["customerName", "discounts[1].reason", "discounts[1].value"]);
        OrderFixtures.FieldErrors(problem, "discounts[1].value").ShouldBe(["Enter a percentage above 0 and up to 100."]);
    }

    [Fact]
    public async Task TwentyOneDiscountsInTheBodyAreA400OnDiscounts()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["discounts"] = Enumerable.Range(0, 21)
            .Select(static _ => new Dictionary<string, object?> { ["kind"] = "fixed", ["value"] = 1m, ["reason"] = "Small" })
            .ToArray();

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "discounts").ShouldBe(["An order can have at most 20 discounts."]);
    }

    private async Task SetRetiredAsync(Guid productTypeId, bool retired)
    {
        await using var context = database.CreateContext();
        DateTimeOffset? at = retired ? TimeProvider.System.GetUtcNow() : null;
        var changed = await context.ProductTypes.Where(type => type.Id == productTypeId)
            .ExecuteUpdateAsync(set => set.SetProperty(type => type.RetiredAtUtc, at), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }
}
