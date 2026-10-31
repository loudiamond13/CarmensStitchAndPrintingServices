using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-16, ORD-17, D-01 to D-06, D-31, D-36, D-38: staff move an order along the owner's seven statuses, and every move is recorded.</summary>
public sealed class OrderStatusEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminMovesAPendingOrderToMockupAndTheMoveShowsInTheHistoryAndOnARead()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("mockup"));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var moved = document.RootElement;
        AssertMovedToMockup(moved, created, admin.UserId, manager.UserId);
        AssertMovedToMockup(await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id), created, admin.UserId, manager.UserId);
    }

    [Fact]
    public async Task AStatusThatIsNotOneOfTheSevenKeysIs400OnStatusAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        foreach (var broken in new string?[] { "shipped", string.Empty, "  ", null, "In Production" })
        {
            using var response = await OrderFixtures.ChangeStatusAsync(client, manager.AccessToken, id, OrderFixtures.StatusBody(broken));

            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, broken ?? "null");
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.invalid-request");
            OrderFixtures.FieldErrors(problem, "status").ShouldBe(["Choose a status."], broken ?? "null");
        }

        using var noBody = await OrderFixtures.ChangeStatusAsync(client, manager.AccessToken, id, body: null);
        noBody.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("status").GetString().ShouldBe("pending");
        stored.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        stored.GetProperty("statusHistory").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.ChangeStatusAsync(client, accessToken: null, Guid.NewGuid(), OrderFixtures.StatusBody("mockup"));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnUnknownOrderAnswers404WithTheOrderNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await OrderFixtures.ChangeStatusAsync(client, manager.AccessToken, Guid.NewGuid(), OrderFixtures.StatusBody("mockup"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task APaidInFullOrderCanBeCompletedAndEitherRoleCanReopenIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);

        foreach (var (reopener, status) in new[] { (admin, "ready"), (manager, "production") })
        {
            var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
            var id = paid.GetProperty("id").GetGuid();

            var completed = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");

            completed.GetProperty("status").GetString().ShouldBe("completed");
            completed.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(0.00m);
            var reopened = await OrderFixtures.ChangeStatusAndReadAsync(client, reopener.AccessToken, id, status);
            reopened.GetProperty("status").GetString().ShouldBe(status);
            var history = reopened.GetProperty("statusHistory").EnumerateArray().ToList();
            history.Count.ShouldBe(3);
            history[1].GetProperty("to").GetString().ShouldBe("completed");
            history[2].GetProperty("from").GetString().ShouldBe("completed");
            history[2].GetProperty("to").GetString().ShouldBe(status);
            history[2].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(reopener.UserId);
        }
    }

    [Fact]
    public async Task CompletingWhileMoneyIsOwedIs422NamingTheBalanceAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        order.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(9327.50m);

        using var response = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("completed"));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.complete-balance-owed");
        problem.GetProperty("detail").GetString().ShouldBe("This order still has ₱9,327.50 to pay. Record the payment first.");
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("status").GetString().ShouldBe("pending");
        stored.GetProperty("version").GetString().ShouldBe(order.GetProperty("version").GetString());
        stored.GetProperty("statusHistory").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task CompletingWithACustomerCreditIs422TheCreditCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var credit = await OrderFixtures.AddDiscountAndReadAsync(client, admin.AccessToken, paid, "fixed", 100m);
        credit.GetProperty("totals").GetProperty("customerCredit").GetDecimal().ShouldBe(100.00m);

        using var response = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, credit.GetProperty("id").GetGuid(), OrderFixtures.StatusBody("completed"));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.complete-credit");
        problem.GetProperty("detail").GetString().ShouldBe("This order has a customer credit of ₱100.00. Record a refund first.");
    }

    [Fact]
    public async Task GoingStraightBetweenCompletedAndCancelledIs422ReopenFirstBothWays()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        var completed = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "completed");

        using var toCancelled = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("cancelled"));

        toCancelled.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var first = await ProblemJson.ReadAsync(toCancelled, TestContext.Current.CancellationToken);
        first.GetProperty("code").GetString().ShouldBe("orders.reopen-first");
        first.GetProperty("detail").GetString().ShouldBe("Reopen the order first, then cancel it.");
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("version").GetString().ShouldBe(completed.GetProperty("version").GetString());

        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "ready");
        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "cancelled");
        using var toCompleted = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("completed"));

        toCompleted.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var second = await ProblemJson.ReadAsync(toCompleted, TestContext.Current.CancellationToken);
        second.GetProperty("code").GetString().ShouldBe("orders.reopen-first");
        second.GetProperty("detail").GetString().ShouldBe("Reopen the order first, then mark it Completed.");
    }

    [Fact]
    public async Task ASameStatusRequestAnswers200ChangesNothingAndKeepsTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        var same = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "pending");

        same.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        same.GetProperty("statusHistory").GetArrayLength().ShouldBe(1);
        same.GetProperty("statusChangedAt").GetDateTimeOffset().ShouldBe(created.GetProperty("statusChangedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task CancellingOrd0148KeepsTheCashAndCostsAndReopeningRestoresTheProfit()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        order.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(15262.50m);

        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        var totals = cancelled.GetProperty("totals");
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(6065.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(5935.00m);
        cancelled.GetProperty("payments").GetArrayLength().ShouldBe(2);
        cancelled.GetProperty("expenses").GetArrayLength().ShouldBe(3);

        var reopened = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "pending");

        reopened.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(15262.50m);
        reopened.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        reopened.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
    }

    [Fact]
    public async Task AMoveWritesOneStatusChangedEntryAReopenWritesOneReopenedEntryAndANoOpWritesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "production");
        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "production");
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");
        var firstReopen = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "ready");
        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "ready");

        var rows = await StatusEntriesAsync(id);
        rows.Select(static row => (row.Action, row.Detail)).ShouldBe(
        [
            ("order.status-changed", "status=pending>production"),
            ("order.status-changed", "status=production>cancelled"),
            ("order.reopened", "status=cancelled>ready"),
        ]);
        rows[0].ActorUserId.ShouldBe(admin.UserId);
        rows[1].ActorUserId.ShouldBe(manager.UserId);
        rows[2].ActorUserId.ShouldBe(manager.UserId);
        rows.ShouldAllBe(static row => row.TargetType == "Order");
        firstReopen.GetProperty("statusHistory").GetArrayLength().ShouldBe(4);
    }

    [Fact]
    public async Task ARefusedMoveWritesNoAuditEntryAndNoHistoryRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var owed = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("completed"));
        using var broken = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("shipped"));

        owed.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        broken.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await StatusEntriesAsync(id)).ShouldBeEmpty();
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("statusHistory").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task TheSameIdempotencyKeyAndBodyTwiceGivesOneHistoryRowAndOneEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var key = Guid.NewGuid();

        using var first = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("mockup"), key);
        using var second = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("mockup"), key);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe(await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("statusHistory").GetArrayLength().ShouldBe(2);
        (await StatusEntriesAsync(id)).Count.ShouldBe(1);
    }

    private async Task<List<AuditEntry>> StatusEntriesAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        var key = orderId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == key && (row.Action == "order.status-changed" || row.Action == "order.reopened"))
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private static void AssertMovedToMockup(JsonElement order, JsonElement created, Guid mover, Guid creator)
    {
        order.GetProperty("status").GetString().ShouldBe("mockup");
        order.GetProperty("statusChangedAt").GetDateTimeOffset().ShouldBeGreaterThan(created.GetProperty("statusChangedAt").GetDateTimeOffset());
        order.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());
        var history = order.GetProperty("statusHistory").EnumerateArray().ToList();
        history.Count.ShouldBe(2);
        OrderFixtures.IsNull(history[0], "from").ShouldBeTrue();
        history[0].GetProperty("to").GetString().ShouldBe("pending");
        history[0].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(creator);
        history[1].GetProperty("from").GetString().ShouldBe("pending");
        history[1].GetProperty("to").GetString().ShouldBe("mockup");
        history[1].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(mover);
        history[1].GetProperty("changedAt").GetDateTimeOffset().ShouldBe(order.GetProperty("statusChangedAt").GetDateTimeOffset());
    }
}
