using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>
/// INQ-06, D-20 to D-23, CWE-362, CWE-862: staff read the New Order prefill of a quote request, and saving the order with the
/// request id turns the request Converted and links the two in the same transaction. One request makes one order: a second save is a
/// 409 with the first order, and the order and the request point at each other.
/// </summary>
public sealed class QuoteConversionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Received = new(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);
    private static readonly Guid BasketballLine = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
    private static readonly string[] TypeNames = ["Charlie Jersey", "Alpha Jersey", "Bravo Jersey"];

    // SqlClient's number for a command that ran out of time.
    private const int SqlTimeout = -2;

    [Fact]
    public async Task ThePrefillHasTheDisplayPhoneTheMessageTheReceivedDayAndTheFirstActiveTypeOfTheLine()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var bravo = await FileTypesUnderBasketballAsync();
        var id = await rig.SeedAsync(new QuoteSeed(
            "Juan Dela Cruz",
            QuoteRequestStatus.Contacted,
            Received,
            Team: "Brgy. San Roque Ballers",
            Phone: "0917.123.4567",
            Email: "juan@example.test",
            Choice: QuoteProductChoice.Line,
            LineId: BasketballLine,
            Title: "Basketball Jerseys",
            Message: "Twelve jerseys, numbers 1 to 12."));

        var body = await PrefillAsync(rig, rig.Admin.AccessToken, id);

        body.GetProperty("quoteRequestId").GetGuid().ShouldBe(id);
        body.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        body.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        var phone = body.GetProperty("contactNumber").GetString().ShouldNotBeNull();
        phone.ShouldBe("0917 123 4567");
        OrderRules.IsValidContactNumber(phone).ShouldBeTrue();
        body.GetProperty("email").GetString().ShouldBe("juan@example.test");
        body.GetProperty("notes").GetString().ShouldBe("Twelve jerseys, numbers 1 to 12.");
        body.GetProperty("receivedOn").GetString().ShouldBe("2026-11-21");
        body.GetProperty("productTypeId").GetGuid().ShouldBe(bravo);
    }

    [Theory]
    [InlineData(QuoteProductChoice.Custom)]
    [InlineData(QuoteProductChoice.NotSure)]
    public async Task CustomDesignOrNotSureSuggestsNoProductType(QuoteProductChoice choice)
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        await FileTypesUnderBasketballAsync();
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received, Choice: choice));

        var body = await PrefillAsync(rig, rig.Admin.AccessToken, id);

        body.GetProperty("productTypeId").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("teamName").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("notes").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AManagerReadsThePrefillAndAnUnknownRequestIs404()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        (await PrefillAsync(rig, manager.AccessToken, id)).GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        using var unknown = await rig.GetAsync(manager.AccessToken, $"{QuoteRequestStaffRig.Route}/{Guid.NewGuid():D}/order-prefill");
        var problem = await QuoteRequestStaffRig.BodyAsync(unknown, HttpStatusCode.NotFound);
        problem.GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
    }

    [Fact]
    public async Task SavingTheOrderWithTheRequestConvertsLinksRecordsAndLeavesTheNewCount()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        (await NewCountAsync(rig)).ShouldBe(1);

        var order = await CreateOrderAsync(rig, id, HttpStatusCode.Created);

        var orderId = order.GetProperty("id").GetGuid();
        var detail = await rig.ReadAsync(id);
        detail.GetProperty("status").GetString().ShouldBe("converted");
        var latest = detail.GetProperty("history").EnumerateArray().First();
        (latest.GetProperty("from").GetString(), latest.GetProperty("to").GetString()).ShouldBe(("new", "converted"));
        latest.GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        (await NewCountAsync(rig)).ShouldBe(0);

        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        (await context.QuoteRequests.Where(request => request.Id == id).Select(request => request.OrderId).SingleAsync(token)).ShouldBe(orderId);
        (await context.QuoteRequestStatusChanges.Where(change => change.QuoteRequestId == id).Select(change => change.OrderId).SingleAsync(token)).ShouldBe(orderId);
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(audit => audit.Action == "quote-request.converted" && audit.TargetId == id.ToString("D"), token);
        (entry.TargetType, entry.ActorUserId, entry.Detail).ShouldBe(("QuoteRequest", (Guid?)rig.Admin.UserId, $"order={orderId:D}"));
    }

    [Fact]
    public async Task AnUnknownRequestIs404AndSavesNoOrder()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);

        var problem = await CreateOrderAsync(rig, Guid.NewGuid(), HttpStatusCode.NotFound);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
        await using var context = database.CreateContext();
        (await context.Orders.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);

        // The 404 is stored and its transaction commits, so a number taken before the lock would be lost: the next order is the first.
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        var next = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        next.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
    }

    [Fact]
    public async Task TwoSavesAtOnceMakeOneOrderAndTheOtherWaitsThenIs409WithTheFirstOrder()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Quoted, Received));
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        Task<(HttpStatusCode Status, JsonElement Body)> first;
        Task<(HttpStatusCode Status, JsonElement Body)> second;

        // The number lock is held, so the first save stops after it locked the request and its transaction stays open.
        await using (var numbers = await HoldLockAsync("order-numbers"))
        {
            first = PostOrderAsync(rig, rig.Admin.AccessToken, id, today);
            await WaitUntilLockedAsync(id);
            second = PostOrderAsync(rig, manager.AccessToken, id, today);
            await Task.Delay(TimeSpan.FromSeconds(1), TestContext.Current.CancellationToken);
            first.IsCompleted.ShouldBeFalse();
            second.IsCompleted.ShouldBeFalse();
        }

        // Without the request lock the second save would load the old row and lose on its version with orders.busy.
        var created = await first;
        created.Status.ShouldBe(HttpStatusCode.Created, created.Body.ToString());
        var refused = await second;
        refused.Status.ShouldBe(HttpStatusCode.Conflict, refused.Body.ToString());
        AssertAlreadyConverted(refused.Body, created.Body);
        await using var context = database.CreateContext();
        (await context.Orders.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        var next = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        next.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0002");
    }

    [Fact]
    public async Task ASaveAfterTheConversionIs409WithTheFirstOrderAndSavesNothing()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var first = await CreateOrderAsync(rig, id, HttpStatusCode.Created);

        var refused = await CreateOrderAsync(rig, id, HttpStatusCode.Conflict);

        AssertAlreadyConverted(refused, first);
        await using var context = database.CreateContext();
        (await context.Orders.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ASecondRequestRowWithTheSameOrderFailsOnTheUniqueIndex()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var other = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.New, Received.AddMinutes(5)));
        var orderId = (await CreateOrderAsync(rig, id, HttpStatusCode.Created)).GetProperty("id").GetGuid();

        await using var context = database.CreateContext();
        var failure = await Should.ThrowAsync<Exception>(() => context.QuoteRequests
            .Where(request => request.Id == other)
            .ExecuteUpdateAsync(set => set.SetProperty(request => request.OrderId, (Guid?)orderId), TestContext.Current.CancellationToken));

        failure.ToString().ShouldContain("IX_QuoteRequests_OrderId");
    }

    [Fact]
    public async Task TheOrderAndTheRequestPointAtEachOtherAndADeletedOrderKeepsTheLink()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var unlinked = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.New, Received.AddMinutes(5)));
        var created = await CreateOrderAsync(rig, id, HttpStatusCode.Created);
        var orderId = created.GetProperty("id").GetGuid();
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        var plain = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        created.GetProperty("quoteRequestId").GetGuid().ShouldBe(id);
        plain.GetProperty("quoteRequestId").ValueKind.ShouldBe(JsonValueKind.Null);
        using (var read = await rig.GetAsync(rig.Admin.AccessToken, $"{OrderFixtures.Route}/{orderId:D}"))
        {
            (await QuoteRequestStaffRig.BodyAsync(read, HttpStatusCode.OK)).GetProperty("quoteRequestId").GetGuid().ShouldBe(id);
        }

        var detail = await rig.ReadAsync(id);
        detail.GetProperty("orderId").GetGuid().ShouldBe(orderId);
        detail.GetProperty("orderNumber").GetString().ShouldBe(created.GetProperty("number").GetString());
        var none = await rig.ReadAsync(unlinked);
        none.GetProperty("orderId").ValueKind.ShouldBe(JsonValueKind.Null);
        none.GetProperty("orderNumber").ValueKind.ShouldBe(JsonValueKind.Null);

        using (var deleted = await OrderFixtures.DeleteAsync(rig.Client, manager.AccessToken, orderId))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using (var read = await OrderFixtures.GetDeletedAsync(rig.Client, manager.AccessToken, orderId))
        {
            (await QuoteRequestStaffRig.BodyAsync(read, HttpStatusCode.OK)).GetProperty("order").GetProperty("quoteRequestId").GetGuid().ShouldBe(id);
        }

        var afterDelete = await rig.ReadAsync(id);
        afterDelete.GetProperty("orderNumber").GetString().ShouldBe(created.GetProperty("number").GetString());
        afterDelete.GetProperty("status").GetString().ShouldBe("converted");
    }

    private static void AssertAlreadyConverted(JsonElement problem, JsonElement first)
    {
        problem.GetProperty("code").GetString().ShouldBe("quote-requests.already-converted");
        problem.GetProperty("detail").GetString().ShouldBe("This quote request was already turned into an order.");
        problem.GetProperty("orderId").GetGuid().ShouldBe(first.GetProperty("id").GetGuid());
        problem.GetProperty("orderNumber").GetString().ShouldBe(first.GetProperty("number").GetString());
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> PostOrderAsync(QuoteRequestStaffRig rig, string token, Guid quoteRequestId, DateOnly today)
    {
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["quoteRequestId"] = quoteRequestId;
        using var response = await OrderFixtures.PostAsync(rig.Client, token, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        return (response.StatusCode, document.RootElement.Clone());
    }

    // Takes a standing lock row in an open transaction, the way a save would, and rolls it back on dispose.
    private async Task<LockHold> HoldLockAsync(string name)
    {
        var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var changed = await context.Set<DatabaseLock>().Where(row => row.Name == name)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
        return new LockHold(context, transaction);
    }

    // Waits until another transaction holds the request's row: an update with a one-second timeout then runs out of time.
    private async Task WaitUntilLockedAsync(Guid id)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            await using var context = database.CreateContext();
            await using var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            context.Database.SetCommandTimeout(1);
            try
            {
                await context.QuoteRequests.Where(request => request.Id == id)
                    .ExecuteUpdateAsync(set => set.SetProperty(request => request.EditVersion, Guid.NewGuid()), TestContext.Current.CancellationToken);
            }
            catch (SqlException error) when (error.Number == SqlTimeout)
            {
                return;
            }

            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
            await Task.Delay(TimeSpan.FromMilliseconds(100), TestContext.Current.CancellationToken);
        }

        throw new TimeoutException("The first save never locked the quote request.");
    }

    private static async Task<JsonElement> PrefillAsync(QuoteRequestStaffRig rig, string token, Guid id)
    {
        using var response = await rig.GetAsync(token, $"{QuoteRequestStaffRig.Route}/{id:D}/order-prefill");
        return await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);
    }

    private static async Task<int> NewCountAsync(QuoteRequestStaffRig rig)
    {
        using var response = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}/new-count");
        return (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK)).GetProperty("count").GetInt32();
    }

    private static async Task<JsonElement> CreateOrderAsync(QuoteRequestStaffRig rig, Guid quoteRequestId, HttpStatusCode expected, string? token = null)
    {
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["quoteRequestId"] = quoteRequestId;
        using var response = await OrderFixtures.PostAsync(rig.Client, token ?? rig.Admin.AccessToken, body);
        return await QuoteRequestStaffRig.BodyAsync(response, expected);
    }

    // Files three types under the basketball line, alone: Alpha retired, Bravo and Charlie active. Bravo is the first active by name.
    private async Task<Guid> FileTypesUnderBasketballAsync()
    {
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        await context.ProductTypes.Where(type => type.ProductLineId == BasketballLine).ExecuteUpdateAsync(set => set.SetProperty(type => type.ProductLineId, (Guid?)null), token);
        var now = TimeProvider.System.GetUtcNow();
        var types = TypeNames.Select(name => ProductType.Create(name, "info", now).Value).ToList();
        foreach (var type in types)
        {
            type.LinkToLine(BasketballLine);
        }

        types[1].Retire(now).IsSuccess.ShouldBeTrue();
        context.ProductTypes.AddRange(types);
        await context.SaveChangesAsync(token);
        return types[2].Id;
    }

    private sealed class LockHold(CspsDbContext context, IDbContextTransaction transaction) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            await transaction.RollbackAsync(CancellationToken.None);
            await transaction.DisposeAsync();
            await context.DisposeAsync();
        }
    }
}
