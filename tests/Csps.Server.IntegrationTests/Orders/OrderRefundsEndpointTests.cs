using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-18, ORD-05, ORD-08, D-07, D-09, D-13, D-30, D-34 to D-36: staff record, correct and remove refunds, and the money follows.</summary>
public sealed class OrderRefundsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminRefundsTheDownpaymentOnACancelledOrderAndTheOrderShowsALossOfItsExpenses()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = created.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.RefundBody(today, 12000.00m, "Order cancelled by the team", manager.UserId, cancelled.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var after = document.RootElement;
        var totals = after.GetProperty("totals");
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(6065.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(-6065.00m);
        var refund = after.GetProperty("refunds").EnumerateArray().ShouldHaveSingleItem();
        refund.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        refund.GetProperty("refundDate").GetString().ShouldBe(OrderFixtures.Date(today));
        refund.GetProperty("amount").GetDecimal().ShouldBe(12000.00m);
        refund.GetProperty("reason").GetString().ShouldBe("Order cancelled by the team");
        refund.GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        refund.GetProperty("refundedByActive").GetBoolean().ShouldBeTrue();
        refund.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        after.GetProperty("version").GetString().ShouldNotBe(cancelled.GetProperty("version").GetString());
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("refunds").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(-6065.00m);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddRefundAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnUnknownOrderAnswers404WithTheOrderNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.RefundBody(today, 100m, "Wrong order", manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task AFixedDiscountOnAFullyPaidOrderLeavesACreditThatARefundClearsSoTheOrderCanBeCompleted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        var inCredit = await OrderFixtures.AddDiscountAndReadAsync(client, admin.AccessToken, paid, "fixed", 500m, "Late delivery");
        inCredit.GetProperty("totals").GetProperty("customerCredit").GetDecimal().ShouldBe(500.00m);
        using var refused = await OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("completed"));
        refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);

        var refunded = await OrderFixtures.AddRefundAndReadAsync(client, admin.AccessToken, inCredit, today, 500m, manager.UserId, "Late delivery credit");

        var totals = refunded.GetProperty("totals");
        totals.GetProperty("balance").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(500.00m);
        var completed = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "completed");
        completed.GetProperty("status").GetString().ShouldBe("completed");
    }

    [Fact]
    public async Task ARefundOnAnActiveOrderWithNoCreditIs422NotAllowedAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, created, today, 500m, OrderFixtures.CashId, admin.UserId);

        using var response = await OrderFixtures.AddRefundAsync(
            client, admin.AccessToken, id, OrderFixtures.RefundBody(today, 100m, "No credit here", admin.UserId, paid.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.refund-not-allowed");
        problem.GetProperty("detail").GetString().ShouldBe("A refund can be recorded only on a cancelled order or one with a customer credit.");
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("version").GetString().ShouldBe(paid.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnAmountAboveWhatWasPaidOnACancelledOrderIs400OnAmountWithTheKeptMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var cancelled = await CancelledOrd0148Async(client, admin, manager, today);

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            admin.AccessToken,
            cancelled.GetProperty("id").GetGuid(),
            OrderFixtures.RefundBody(today, 12000.01m, "Too much", manager.UserId, cancelled.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["amount"]);
        OrderFixtures.FieldErrors(problem, "amount").ShouldBe(["This is more than was paid and not yet refunded. Enter ₱12,000.00 or less."]);
    }

    [Fact]
    public async Task AnEmptyBodyListsEveryRefundFieldAndTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await OrderFixtures.AddRefundAsync(client, admin.AccessToken, Guid.NewGuid(), new Dictionary<string, object?>());

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["amount", "reason", "refundDate", "refundedByUserId", "version"], ignoreOrder: true);
        OrderFixtures.FieldErrors(problem, "refundDate").ShouldBe(["Enter the refund date."]);
        OrderFixtures.FieldErrors(problem, "reason").ShouldBe(["Add a short reason for the refund."]);
        OrderFixtures.FieldErrors(problem, "refundedByUserId").ShouldBe(["Choose who handed the money back."]);
    }

    [Fact]
    public async Task ARefundDatedAfterTodayIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var cancelled = await CancelledOrd0148Async(client, admin, manager, today);

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            admin.AccessToken,
            cancelled.GetProperty("id").GetGuid(),
            OrderFixtures.RefundBody(today.AddDays(1), 100m, "Tomorrow", manager.UserId, cancelled.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "refundDate").ShouldBe(["The refund date can't be in the future."]);
    }

    [Fact]
    public async Task ARefundOnACancelledOrderCanBeEditedAndRemovedWithoutReopeningAndTheProfitFollows()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var cancelled = await CancelledOrd0148Async(client, admin, manager, today);
        var id = cancelled.GetProperty("id").GetGuid();
        var refunded = await OrderFixtures.AddRefundAndReadAsync(client, admin.AccessToken, cancelled, today, 4000m, manager.UserId);
        var refundId = refunded.GetProperty("refunds")[0].GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutRefundAsync(
            client,
            manager.AccessToken,
            id,
            refundId,
            OrderFixtures.RefundBody(today.AddDays(-1), 12000m, "Full refund after the team folded", admin.UserId, refunded.GetProperty("version").GetString()));
        var editText = await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, editText);
        using var editDocument = JsonDocument.Parse(editText);
        var edited = editDocument.RootElement;
        edited.GetProperty("status").GetString().ShouldBe("cancelled");
        edited.GetProperty("totals").GetProperty("refunded").GetDecimal().ShouldBe(12000.00m);
        edited.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(-6065.00m);
        var shown = edited.GetProperty("refunds")[0];
        shown.GetProperty("refundDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-1)));
        shown.GetProperty("reason").GetString().ShouldBe("Full refund after the team folded");
        shown.GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        shown.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        shown.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        edited.GetProperty("version").GetString().ShouldNotBe(refunded.GetProperty("version").GetString());

        using var remove = await OrderFixtures.DeleteRefundAsync(client, admin.AccessToken, id, refundId);
        var removeText = await remove.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        remove.StatusCode.ShouldBe(HttpStatusCode.OK, removeText);
        using var removeDocument = JsonDocument.Parse(removeText);
        var removed = removeDocument.RootElement;
        removed.GetProperty("refunds").GetArrayLength().ShouldBe(0);
        removed.GetProperty("totals").GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        removed.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(5935.00m);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("refunds").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task ARefundIdFromAnotherOrderIsNeverFoundOnEditOrRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await CancelledOrd0148Async(client, admin, manager, today);
        var second = await CancelledOrd0148Async(client, admin, manager, today);
        var firstWithRefund = await OrderFixtures.AddRefundAndReadAsync(client, admin.AccessToken, first, today, 100m, manager.UserId);
        var foreignId = firstWithRefund.GetProperty("refunds")[0].GetProperty("id").GetGuid();
        var secondId = second.GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutRefundAsync(
            client, admin.AccessToken, secondId, foreignId, OrderFixtures.RefundBody(today, 100m, "Wrong order", manager.UserId, second.GetProperty("version").GetString()));
        using var remove = await OrderFixtures.DeleteRefundAsync(client, admin.AccessToken, secondId, foreignId);
        using var unknown = await OrderFixtures.DeleteRefundAsync(client, admin.AccessToken, Guid.NewGuid(), Guid.NewGuid());

        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.refund-not-found");
        remove.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(remove, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.refund-not-found");
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, firstWithRefund.GetProperty("id").GetGuid())).GetProperty("refunds").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task ARefundSentTwiceWithTheSameKeyAndBodyIsRecordedOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var cancelled = await CancelledOrd0148Async(client, admin, manager, today);
        var id = cancelled.GetProperty("id").GetGuid();
        var body = OrderFixtures.RefundBody(today, 500m, "Order cancelled by the team", manager.UserId, cancelled.GetProperty("version").GetString());
        var key = Guid.NewGuid();

        using var first = await OrderFixtures.AddRefundAsync(client, admin.AccessToken, id, body, key);
        using var second = await OrderFixtures.AddRefundAsync(client, admin.AccessToken, id, body, key);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("refunds").GetArrayLength().ShouldBe(1);
    }

    private static async Task<JsonElement> CancelledOrd0148Async(HttpClient client, StartedSession admin, StartedSession manager, DateOnly today)
    {
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        return await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), "cancelled");
    }
}
