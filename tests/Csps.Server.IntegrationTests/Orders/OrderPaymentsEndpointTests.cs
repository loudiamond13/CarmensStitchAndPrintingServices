using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, ORD-22, D-11, D-12, D-30, D-31: staff record payments and the balance follows every change.</summary>
public sealed class OrderPaymentsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheOrd0148PaymentsLeaveABalanceOf9327AndEachPaymentNamesWhoReceivedIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var discounted = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var id = discounted.GetProperty("id").GetGuid();

        using var firstResponse = await OrderFixtures.AddPaymentAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.PaymentBody(today.AddDays(-3), 10000.00m, OrderFixtures.GCashId, admin.UserId, discounted.GetProperty("version").GetString(), "9012 345 678901", "50% downpayment"));
        var firstText = await firstResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        firstResponse.StatusCode.ShouldBe(HttpStatusCode.OK, firstText);
        using var firstDocument = JsonDocument.Parse(firstText);
        var afterFirst = firstDocument.RootElement.Clone();
        afterFirst.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(10000.00m);
        afterFirst.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(11327.50m);

        var afterSecond = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, afterFirst, today.AddDays(-1), 2000.00m, OrderFixtures.CashId, manager.UserId);

        var totals = afterSecond.GetProperty("totals");
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        var payments = afterSecond.GetProperty("payments").EnumerateArray().ToList();
        payments.Count.ShouldBe(2);
        var gcash = payments[0];
        gcash.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        gcash.GetProperty("paymentDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-3)));
        gcash.GetProperty("amount").GetDecimal().ShouldBe(10000.00m);
        gcash.GetProperty("method").GetProperty("id").GetGuid().ShouldBe(OrderFixtures.GCashId);
        gcash.GetProperty("method").GetProperty("name").GetString().ShouldBe("GCash");
        gcash.GetProperty("method").GetProperty("tone").GetString().ShouldNotBeNullOrEmpty();
        gcash.GetProperty("method").GetProperty("retired").GetBoolean().ShouldBeFalse();
        gcash.GetProperty("reference").GetString().ShouldBe("9012 345 678901");
        gcash.GetProperty("notes").GetString().ShouldBe("50% downpayment");
        gcash.GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        gcash.GetProperty("receivedByActive").GetBoolean().ShouldBeTrue();
        gcash.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var cash = payments[1];
        cash.GetProperty("amount").GetDecimal().ShouldBe(2000.00m);
        cash.GetProperty("method").GetProperty("name").GetString().ShouldBe("Cash");
        cash.GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        cash.GetProperty("receivedByActive").GetBoolean().ShouldBeTrue();
        cash.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("payments").GetArrayLength().ShouldBe(2);
        read.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        read.GetProperty("version").GetString().ShouldBe(afterSecond.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddPaymentAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddPaymentAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task EditingAndRemovingAPaymentRecomputeThePaidTotalAndTheBalance()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await Ord0148WithDiscountAsync(client, manager.AccessToken, today);
        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, order, today.AddDays(-3), 10000.00m, OrderFixtures.GCashId, manager.UserId);
        var id = paid.GetProperty("id").GetGuid();
        var paymentId = paid.GetProperty("payments")[0].GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            id,
            paymentId,
            OrderFixtures.PaymentBody(today.AddDays(-2), 8000.00m, OrderFixtures.CashId, manager.UserId, paid.GetProperty("version").GetString(), "Receipt 7", "Lowered"));
        var editText = await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, editText);
        using var editDocument = JsonDocument.Parse(editText);
        var edited = editDocument.RootElement;
        edited.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(8000.00m);
        edited.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(13327.50m);
        var shown = edited.GetProperty("payments").EnumerateArray().ShouldHaveSingleItem();
        shown.GetProperty("paymentDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-2)));
        shown.GetProperty("method").GetProperty("name").GetString().ShouldBe("Cash");
        shown.GetProperty("reference").GetString().ShouldBe("Receipt 7");
        shown.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        edited.GetProperty("version").GetString().ShouldNotBe(paid.GetProperty("version").GetString());

        using var remove = await OrderFixtures.DeletePaymentAsync(client, manager.AccessToken, id, paymentId);
        var removeText = await remove.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        remove.StatusCode.ShouldBe(HttpStatusCode.OK, removeText);
        using var removeDocument = JsonDocument.Parse(removeText);
        var removed = removeDocument.RootElement;
        removed.GetProperty("payments").GetArrayLength().ShouldBe(0);
        removed.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(0.00m);
        removed.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("payments").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task APaymentIdFromAnotherOrderIsNeverFoundOnEditOrRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var firstPaid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, first, today, 100m, OrderFixtures.CashId, manager.UserId);
        var foreignId = firstPaid.GetProperty("payments")[0].GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            second.GetProperty("id").GetGuid(),
            foreignId,
            OrderFixtures.PaymentBody(today, 50m, OrderFixtures.CashId, manager.UserId, second.GetProperty("version").GetString()));
        using var remove = await OrderFixtures.DeletePaymentAsync(client, manager.AccessToken, second.GetProperty("id").GetGuid(), foreignId);

        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.payment-not-found");
        remove.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(remove, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.payment-not-found");
        var stillThere = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, first.GetProperty("id").GetGuid());
        stillThere.GetProperty("payments")[0].GetProperty("amount").GetDecimal().ShouldBe(100m);
    }

    [Fact]
    public async Task APaymentOf20000OnABalanceOf9327IsA400OnAmountWithTheMostThatCanBeEntered()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await Ord0148WithDiscountAsync(client, manager.AccessToken, today);
        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, order, today, 12000.00m, OrderFixtures.CashId, manager.UserId);

        using var response = await OrderFixtures.AddPaymentAsync(
            client,
            manager.AccessToken,
            paid.GetProperty("id").GetGuid(),
            OrderFixtures.PaymentBody(today, 20000.00m, OrderFixtures.CashId, manager.UserId, paid.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["amount"]);
        OrderFixtures.FieldErrors(problem, "amount").ShouldBe(["This is more than the balance. Enter ₱9,327.50 or less."]);
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, paid.GetProperty("id").GetGuid());
        stored.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        stored.GetProperty("version").GetString().ShouldBe(paid.GetProperty("version").GetString());
    }

    [Fact]
    public async Task OnceAnOrderIsPaidInFullAnotherPaymentIsRefusedWithNothingOwed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var full = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 9750.00m, OrderFixtures.CashId, manager.UserId);
        full.GetProperty("totals").GetProperty("fullyPaid").GetBoolean().ShouldBeTrue();

        using var response = await OrderFixtures.AddPaymentAsync(
            client,
            manager.AccessToken,
            full.GetProperty("id").GetGuid(),
            OrderFixtures.PaymentBody(today, 0.01m, OrderFixtures.CashId, manager.UserId, full.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "amount").ShouldBe(["Nothing is owed on this order."]);
    }

    [Fact]
    public async Task AfterFullPaymentAFixedDiscountOf500IsAcceptedAndLeavesACustomerCreditOf500()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var full = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 9750.00m, OrderFixtures.CashId, manager.UserId);

        var discounted = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, full, "fixed", 500m, "Goodwill");

        var totals = discounted.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(9250.00m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(-500.00m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(500.00m);
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        read.GetProperty("totals").GetProperty("customerCredit").GetDecimal().ShouldBe(500.00m);
    }

    [Fact]
    public async Task AfterFullPaymentRemovingAnItemAndLoweringAQuantityLeaveACustomerCredit()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var withTwoItems = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.PoloId);
        withTwoItems.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(10850.00m);
        var full = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, withTwoItems, today, 10850.00m, OrderFixtures.CashId, manager.UserId);
        var id = full.GetProperty("id").GetGuid();
        var poloId = full.GetProperty("items")[1].GetProperty("id").GetGuid();

        using var removeItem = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, poloId);

        removeItem.StatusCode.ShouldBe(HttpStatusCode.OK, await removeItem.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        after.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(9750.00m);
        after.GetProperty("totals").GetProperty("customerCredit").GetDecimal().ShouldBe(1100.00m);
        using var lower = await OrderFixtures.PutItemAsync(
            client,
            manager.AccessToken,
            id,
            after.GetProperty("items")[0].GetProperty("id").GetGuid(),
            OrderFixtures.ItemBody(OrderFixtures.BasketballId, after.GetProperty("version").GetString(), "Jersey top", "S-XL", 10, 650.00m));
        lower.StatusCode.ShouldBe(HttpStatusCode.OK, await lower.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var lowered = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        lowered.GetProperty("totals").GetProperty("customerCredit").GetDecimal().ShouldBe(4350.00m);
    }

    [Fact]
    public async Task ARetiredMethodIsRefusedOnAddAndOnSwitchButAKeptRetiredMethodMayBeEdited()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var method = await OrderFixtures.AddPaymentMethodAsync(database, retired: false);
        var retiredElsewhere = await OrderFixtures.AddPaymentMethodAsync(database, retired: true);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 500m, method, manager.UserId);
        var id = paid.GetProperty("id").GetGuid();
        var paymentId = paid.GetProperty("payments")[0].GetProperty("id").GetGuid();
        await OrderFixtures.RetirePaymentMethodAsync(database, method);

        using var add = await OrderFixtures.AddPaymentAsync(
            client, manager.AccessToken, id, OrderFixtures.PaymentBody(today, 100m, retiredElsewhere, manager.UserId, paid.GetProperty("version").GetString()));
        using var switched = await OrderFixtures.PutPaymentAsync(
            client, manager.AccessToken, id, paymentId, OrderFixtures.PaymentBody(today, 500m, retiredElsewhere, manager.UserId, paid.GetProperty("version").GetString()));
        using var kept = await OrderFixtures.PutPaymentAsync(
            client, manager.AccessToken, id, paymentId, OrderFixtures.PaymentBody(today, 450m, method, manager.UserId, paid.GetProperty("version").GetString()));

        add.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(add, TestContext.Current.CancellationToken), "paymentMethodId")
            .ShouldBe(["This payment method was retired. Choose another one."]);
        switched.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        kept.StatusCode.ShouldBe(HttpStatusCode.OK, await kept.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("payments")[0].GetProperty("method").GetProperty("retired").GetBoolean().ShouldBeTrue();
        stored.GetProperty("payments")[0].GetProperty("amount").GetDecimal().ShouldBe(450m);
    }

    [Fact]
    public async Task EveryPaymentFieldRuleAnswersA400OnItsField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var version = created.GetProperty("version").GetString();

        async Task<IReadOnlyList<string>> ErrorsAsync(Dictionary<string, object?> body, string field)
        {
            using var response = await OrderFixtures.AddPaymentAsync(client, manager.AccessToken, id, body);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            return OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), field);
        }

        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 0m, OrderFixtures.CashId, manager.UserId, version), "amount")).ShouldBe(["Enter an amount from ₱0.01 to ₱1,000,000.00."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 1_000_000.01m, OrderFixtures.CashId, manager.UserId, version), "amount")).ShouldBe(["Enter an amount from ₱0.01 to ₱1,000,000.00."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 0.001m, OrderFixtures.CashId, manager.UserId, version), "amount")).ShouldBe(["Use at most 2 decimal places."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today.AddDays(1), 100m, OrderFixtures.CashId, manager.UserId, version), "paymentDate")).ShouldBe(["The payment date can't be in the future."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, version, new string('r', 101)), "reference")).ShouldBe(["Keep the reference to 100 characters or fewer."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, version, null, new string('n', 501)), "notes")).ShouldBe(["Keep notes to 500 characters or fewer."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, null, version), "receivedByUserId")).ShouldBe(["Choose who received the money."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, 100m, null, manager.UserId, version), "paymentMethodId")).ShouldBe(["Choose a payment method."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(null, 100m, OrderFixtures.CashId, manager.UserId, version), "paymentDate")).ShouldBe(["Enter the payment date."]);
        (await ErrorsAsync(OrderFixtures.PaymentBody(today, null, OrderFixtures.CashId, manager.UserId, version), "amount")).ShouldBe(["Enter the amount."]);
    }

    [Fact]
    public async Task APaymentOf1000000IsAcceptedOnAnOrderThatCoversIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId, "Big order", null, 10_000, 100.00m) };
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, body);

        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 1_000_000.00m, OrderFixtures.CashId, manager.UserId);

        paid.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(1_000_000.00m);
        paid.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(0.00m);
    }

    [Fact]
    public async Task AStaleVersionOnAddOrEditIs409AndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var paid = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 500m, OrderFixtures.CashId, manager.UserId);
        var id = paid.GetProperty("id").GetGuid();

        using var add = await OrderFixtures.AddPaymentAsync(
            client, manager.AccessToken, id, OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, created.GetProperty("version").GetString()));
        using var edit = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            id,
            paid.GetProperty("payments")[0].GetProperty("id").GetGuid(),
            OrderFixtures.PaymentBody(today, 300m, OrderFixtures.CashId, manager.UserId, created.GetProperty("version").GetString()));

        add.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        edit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("payments").GetArrayLength().ShouldBe(1);
        stored.GetProperty("payments")[0].GetProperty("amount").GetDecimal().ShouldBe(500m);
    }

    private static async Task<JsonElement> Ord0148WithDiscountAsync(HttpClient client, string token, DateOnly today)
    {
        var created = await OrderFixtures.CreateAsync(client, token, OrderFixtures.Ord0148ItemsBody(today));
        return await OrderFixtures.AddDiscountAndReadAsync(client, token, created, "percentage", 5m);
    }
}
