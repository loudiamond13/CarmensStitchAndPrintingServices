using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// ORD-08, SEC-07, T-07-17: two staff saving the same order with the same version never both win. The stored details are the
/// winner's, the loser's are never stored, and only the winner leaves an audit entry. Item and payment cases follow.
/// </summary>
public sealed class OrderConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const int Repetitions = 10;
    private const int RemovalRounds = 5;

    [Fact]
    public async Task TwoStaffSavingTheSameOrderWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        for (var round = 1; round <= Repetitions; round++)
        {
            var opened = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var byM1 = OrderFixtures.DetailsBodyFrom(opened);
            byM1["notes"] = $"First {round}";
            var byM2 = OrderFixtures.DetailsBodyFrom(opened);
            byM2["notes"] = $"Second {round}";

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.PutDetailsAsync(client, m1.AccessToken, id, byM1),
                () => OrderFixtures.PutDetailsAsync(client, m2.AccessToken, id, byM2));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");

            var (winner, loser, winnerNotes, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, $"First {round}", m1.UserId)
                : (secondResponse, firstResponse, $"Second {round}", m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            won.GetProperty("notes").GetString().ShouldBe(winnerNotes, $"round {round}");
            var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            stored.GetProperty("notes").GetString().ShouldBe(winnerNotes, $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");
            stored.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(winnerId, $"round {round}");

            await using var context = database.CreateContext();
            var changed = await context.AuditLog.CountAsync(
                row => row.Action == "order.changed" && row.TargetId == id.ToString("D"),
                TestContext.Current.CancellationToken);
            changed.ShouldBe(round, $"round {round}: one order.changed entry per round");
        }
    }

    [Fact]
    public async Task TwoEditsOfDifferentFieldsWithTheSameVersionStillGiveOneWinner()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var byName = OrderFixtures.DetailsBodyFrom(created);
        byName["customerName"] = "Maria Santos";
        var byDate = OrderFixtures.DetailsBodyFrom(created);
        byDate["dueDate"] = OrderFixtures.Date(today.AddDays(30));

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => OrderFixtures.PutDetailsAsync(client, m1.AccessToken, id, byName),
            () => OrderFixtures.PutDetailsAsync(client, m2.AccessToken, id, byDate));
        using var firstResponse = first;
        using var secondResponse = second;

        var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
        statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, string.Join(", ", statuses));
        statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, string.Join(", ", statuses));
        var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
        var nameWon = firstResponse.StatusCode == HttpStatusCode.OK;
        stored.GetProperty("customerName").GetString().ShouldBe(nameWon ? "Maria Santos" : "Juan Dela Cruz");
        stored.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(nameWon ? today.AddDays(14) : today.AddDays(30)));
    }

    [Fact]
    public async Task ALaterSaveWithTheOriginalVersionIsRefusedAndStoresNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var original = OrderFixtures.DetailsBodyFrom(created);
        var firstEdit = OrderFixtures.DetailsBodyFrom(created);
        firstEdit["notes"] = "Accepted";
        using (var accepted = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, firstEdit))
        {
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        original["notes"] = "Late";
        using var late = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, original);

        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var refusal = await ProblemJson.ReadAsync(late, TestContext.Current.CancellationToken);
        refusal.GetProperty("code").GetString().ShouldBe("edit.stale");
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("notes").GetString().ShouldBe("Accepted");
    }

    [Fact]
    public async Task TwoItemAddsWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        for (var round = 1; round <= Repetitions; round++)
        {
            var opened = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var version = opened.GetProperty("version").GetString();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.AddItemAsync(client, m1.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, version, $"First {round}")),
                () => OrderFixtures.AddItemAsync(client, m2.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, version, $"Second {round}")));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var (winner, loser, winnerText, loserText) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, $"First {round}", $"Second {round}")
                : (secondResponse, firstResponse, $"Second {round}", $"First {round}");
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            won.GetProperty("items").GetArrayLength().ShouldBe(round + 1, $"round {round}");
            var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var descriptions = stored.GetProperty("items").EnumerateArray().Select(static item => item.GetProperty("description").GetString()).ToList();
            descriptions.Count.ShouldBe(round + 1, $"round {round}: exactly one new item");
            descriptions.ShouldContain(winnerText, customMessage: $"round {round}");
            descriptions.ShouldNotContain(loserText, customMessage: $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");
            stored.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m + (round * 1100.00m), $"round {round}");

            await using var context = database.CreateContext();
            var added = await context.AuditLog.CountAsync(
                row => row.Action == "order-item.added" && row.TargetId == id.ToString("D"),
                TestContext.Current.CancellationToken);
            added.ShouldBe(round, $"round {round}: one order-item.added entry per round");
        }
    }

    [Fact]
    public async Task TwoRemovalsOfDifferentItemsOnAThreeItemOrderBothSucceedAndLeaveOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var staff = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        for (var round = 1; round <= RemovalRounds; round++)
        {
            var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
            body["items"] = new[]
            {
                OrderFixtures.Item(OrderFixtures.BasketballId, "Keep", null, 1, 100.00m),
                OrderFixtures.Item(OrderFixtures.PoloId, "Drop one", null, 1, 200.00m),
                OrderFixtures.Item(OrderFixtures.LongSleevesId, "Drop two", null, 1, 300.00m),
            };
            var created = await OrderFixtures.CreateAsync(client, staff.AccessToken, body);
            var id = created.GetProperty("id").GetGuid();
            var dropOne = created.GetProperty("items")[1].GetProperty("id").GetGuid();
            var dropTwo = created.GetProperty("items")[2].GetProperty("id").GetGuid();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.DeleteItemAsync(client, staff.AccessToken, id, dropOne),
                () => OrderFixtures.DeleteItemAsync(client, other.AccessToken, id, dropTwo));
            using var firstResponse = first;
            using var secondResponse = second;

            firstResponse.StatusCode.ShouldBe(HttpStatusCode.OK, $"round {round}: {await firstResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)}");
            secondResponse.StatusCode.ShouldBe(HttpStatusCode.OK, $"round {round}: {await secondResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)}");
            var stored = await OrderFixtures.ReadDetailAsync(client, staff.AccessToken, id);
            stored.GetProperty("items").GetArrayLength().ShouldBe(1, $"round {round}");
            stored.GetProperty("items")[0].GetProperty("description").GetString().ShouldBe("Keep", $"round {round}");
            stored.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(100.00m, $"round {round}");
        }
    }

    [Fact]
    public async Task TwoRemovalsOfDifferentItemsOnATwoItemOrderGiveOneSuccessAndOneLastItemRefusal()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var staff = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        for (var round = 1; round <= RemovalRounds; round++)
        {
            var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
            body["items"] = new[]
            {
                OrderFixtures.Item(OrderFixtures.BasketballId, "Left", null, 1, 100.00m),
                OrderFixtures.Item(OrderFixtures.PoloId, "Right", null, 1, 200.00m),
            };
            var created = await OrderFixtures.CreateAsync(client, staff.AccessToken, body);
            var id = created.GetProperty("id").GetGuid();
            var left = created.GetProperty("items")[0].GetProperty("id").GetGuid();
            var right = created.GetProperty("items")[1].GetProperty("id").GetGuid();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.DeleteItemAsync(client, staff.AccessToken, id, left),
                () => OrderFixtures.DeleteItemAsync(client, other.AccessToken, id, right));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.UnprocessableEntity).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var loser = firstResponse.StatusCode == HttpStatusCode.OK ? secondResponse : firstResponse;
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("orders.last-item", $"round {round}");
            (await OrderFixtures.ReadDetailAsync(client, staff.AccessToken, id)).GetProperty("items").GetArrayLength().ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task TwoPaymentsOf5000OnABalanceOf9327WithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        for (var round = 1; round <= Repetitions; round++)
        {
            var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
            var discounted = await OrderFixtures.AddDiscountAndReadAsync(client, m1.AccessToken, created, "percentage", 5m);
            var opened = await OrderFixtures.AddPaymentAndReadAsync(client, m1.AccessToken, discounted, today, 12000.00m, OrderFixtures.CashId, m1.UserId);
            opened.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(9327.50m, $"round {round}");
            var id = opened.GetProperty("id").GetGuid();
            var version = opened.GetProperty("version").GetString();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.AddPaymentAsync(client, m1.AccessToken, id, OrderFixtures.PaymentBody(today, 5000.00m, OrderFixtures.GCashId, m1.UserId, version)),
                () => OrderFixtures.AddPaymentAsync(client, m2.AccessToken, id, OrderFixtures.PaymentBody(today, 5000.00m, OrderFixtures.GCashId, m2.UserId, version)));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var (winner, loser, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, m1.UserId)
                : (secondResponse, firstResponse, m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var totals = stored.GetProperty("totals");
            totals.GetProperty("paid").GetDecimal().ShouldBe(17000.00m, $"round {round}: the winner's 5,000.00 on top of 12,000.00");
            totals.GetProperty("balance").GetDecimal().ShouldBe(4327.50m, $"round {round}: never overpaid");
            totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m, $"round {round}");
            var payments = stored.GetProperty("payments").EnumerateArray().ToList();
            payments.Count.ShouldBe(2, $"round {round}: exactly one new payment");
            payments.Count(payment => payment.GetProperty("receivedBy").GetProperty("id").GetGuid() == winnerId).ShouldBeGreaterThanOrEqualTo(1, $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");

            await using var context = database.CreateContext();
            var added = await context.AuditLog.CountAsync(
                row => row.Action == "order-payment.added" && row.TargetId == id.ToString("D"),
                TestContext.Current.CancellationToken);
            added.ShouldBe(2, $"round {round}: the setup payment and the winner, never the loser");
        }
    }

    [Fact]
    public async Task TwoRefundsOf7000OnACancelledOrderPaid12000WithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        for (var round = 1; round <= Repetitions; round++)
        {
            var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.Ord0148FullBody(today, m2.UserId, m1.UserId));
            var id = created.GetProperty("id").GetGuid();
            var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, m1.AccessToken, id, "cancelled");
            cancelled.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(12000.00m, $"round {round}");
            var version = cancelled.GetProperty("version").GetString();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.AddRefundAsync(client, m1.AccessToken, id, OrderFixtures.RefundBody(today, 7000.00m, "Order cancelled by the team", m1.UserId, version)),
                () => OrderFixtures.AddRefundAsync(client, m2.AccessToken, id, OrderFixtures.RefundBody(today, 7000.00m, "Order cancelled by the team", m2.UserId, version)));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var (winner, loser, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, m1.UserId)
                : (secondResponse, firstResponse, m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var totals = stored.GetProperty("totals");
            totals.GetProperty("refunded").GetDecimal().ShouldBe(7000.00m, $"round {round}: one refund only, never above the 12,000.00 paid");
            totals.GetProperty("refunded").GetDecimal().ShouldBeLessThanOrEqualTo(12000.00m, $"round {round}");
            var refunds = stored.GetProperty("refunds").EnumerateArray().ToList();
            refunds.Count.ShouldBe(1, $"round {round}");
            refunds[0].GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(winnerId, $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");

            await using var context = database.CreateContext();
            var added = await context.AuditLog.CountAsync(
                row => row.Action == "order-refund.added" && row.TargetId == id.ToString("D"),
                TestContext.Current.CancellationToken);
            added.ShouldBe(1, $"round {round}: the winner, never the loser");
        }
    }

    [Fact]
    public async Task ACompleteRacingAFixedDiscountNeverLeavesACompletedOrderWithAnUnsettledBalance()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var completedFirst = 0;
        var discountedFirst = 0;

        for (var round = 1; round <= Repetitions; round++)
        {
            var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
            var id = paid.GetProperty("id").GetGuid();
            var version = paid.GetProperty("version").GetString();

            var (complete, discount) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.ChangeStatusAsync(client, admin.AccessToken, id, OrderFixtures.StatusBody("completed")),
                () => OrderFixtures.AddDiscountAsync(client, manager.AccessToken, id, OrderFixtures.DiscountBody("fixed", 100.00m, "Late delivery", version)));
            using var completeResponse = complete;
            using var discountResponse = discount;

            var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
            var totals = stored.GetProperty("totals");
            var detail = $"round {round}: complete {completeResponse.StatusCode}, discount {discountResponse.StatusCode}";
            if (stored.GetProperty("status").GetString() == "completed")
            {
                completedFirst++;
                totals.GetProperty("balance").GetDecimal().ShouldBe(0.00m, detail);
                totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m, detail);
                stored.GetProperty("discounts").GetArrayLength().ShouldBe(1, detail);
                completeResponse.StatusCode.ShouldBe(HttpStatusCode.OK, detail);
                discountResponse.StatusCode.ShouldBeOneOf([HttpStatusCode.Conflict, HttpStatusCode.UnprocessableEntity], detail);
                var refusal = await ProblemJson.ReadAsync(discountResponse, TestContext.Current.CancellationToken);
                refusal.GetProperty("code").GetString().ShouldBeOneOf(["edit.stale", "orders.locked"], detail);
            }
            else
            {
                discountedFirst++;
                stored.GetProperty("status").GetString().ShouldBe("pending", detail);
                totals.GetProperty("customerCredit").GetDecimal().ShouldBe(100.00m, detail);
                stored.GetProperty("discounts").GetArrayLength().ShouldBe(2, detail);
                discountResponse.StatusCode.ShouldBe(HttpStatusCode.OK, detail);
                completeResponse.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, detail);
                var refusal = await ProblemJson.ReadAsync(completeResponse, TestContext.Current.CancellationToken);
                refusal.GetProperty("code").GetString().ShouldBe("orders.complete-credit", detail);
                stored.GetProperty("statusHistory").GetArrayLength().ShouldBe(1, detail);
            }
        }

        (completedFirst + discountedFirst).ShouldBe(Repetitions);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }
}
