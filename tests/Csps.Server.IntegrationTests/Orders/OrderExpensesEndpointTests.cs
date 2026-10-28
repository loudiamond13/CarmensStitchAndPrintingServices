using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, ORD-23, D-17, D-30, D-31: staff record what an order cost and who paid it, and the profit follows every change.</summary>
public sealed class OrderExpensesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminRecordsAnExpensePaidByAManagerAndTheExpensesAndProfitUpdateWithTheBalanceUntouched()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await Ord0148WithDiscountAsync(client, manager.AccessToken, today);
        var id = order.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddExpenseAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.ExpenseBody(today.AddDays(-5), OrderFixtures.FabricId, "Dri-fit mesh, 45 yds", 3825.00m, manager.UserId, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var after = document.RootElement;
        var totals = after.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(3825.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(17502.50m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        var expense = after.GetProperty("expenses").EnumerateArray().ShouldHaveSingleItem();
        expense.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        expense.GetProperty("expenseDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-5)));
        expense.GetProperty("amount").GetDecimal().ShouldBe(3825.00m);
        expense.GetProperty("description").GetString().ShouldBe("Dri-fit mesh, 45 yds");
        var category = expense.GetProperty("category");
        category.GetProperty("id").GetGuid().ShouldBe(OrderFixtures.FabricId);
        category.GetProperty("name").GetString().ShouldBe("Fabric");
        category.GetProperty("tone").GetString().ShouldNotBeNullOrEmpty();
        category.GetProperty("retired").GetBoolean().ShouldBeFalse();
        expense.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        expense.GetProperty("paidByActive").GetBoolean().ShouldBeTrue();
        expense.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        after.GetProperty("version").GetString().ShouldNotBe(order.GetProperty("version").GetString());
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("expenses").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(17502.50m);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddExpenseAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddExpenseAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task EditingAndRemovingAnExpenseRecomputeTheExpensesAndTheProfitAndLeaveTheBalance()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await Ord0148WithDiscountAsync(client, manager.AccessToken, today);
        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, order, today.AddDays(-5), OrderFixtures.FabricId, 3825.00m, manager.UserId, "Mesh");
        var second = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, withExpense, today.AddDays(-2), OrderFixtures.InkAndPaperId, 1640.00m, manager.UserId);
        var id = second.GetProperty("id").GetGuid();
        var expenseId = second.GetProperty("expenses")[0].GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            id,
            expenseId,
            OrderFixtures.ExpenseBody(today.AddDays(-4), OrderFixtures.OutsourcingId, "Embroidery", 600.00m, manager.UserId, second.GetProperty("version").GetString()));
        var editText = await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, editText);
        using var editDocument = JsonDocument.Parse(editText);
        var edited = editDocument.RootElement;
        edited.GetProperty("totals").GetProperty("expenses").GetDecimal().ShouldBe(2240.00m);
        edited.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(19087.50m);
        edited.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        var shown = edited.GetProperty("expenses").EnumerateArray().Single(expense => expense.GetProperty("id").GetGuid() == expenseId);
        shown.GetProperty("expenseDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-4)));
        shown.GetProperty("category").GetProperty("name").GetString().ShouldBe("Outsourcing");
        shown.GetProperty("description").GetString().ShouldBe("Embroidery");
        shown.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        edited.GetProperty("version").GetString().ShouldNotBe(second.GetProperty("version").GetString());

        using var remove = await OrderFixtures.DeleteExpenseAsync(client, manager.AccessToken, id, expenseId);
        var removeText = await remove.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        remove.StatusCode.ShouldBe(HttpStatusCode.OK, removeText);
        using var removeDocument = JsonDocument.Parse(removeText);
        var removed = removeDocument.RootElement;
        removed.GetProperty("expenses").GetArrayLength().ShouldBe(1);
        removed.GetProperty("totals").GetProperty("expenses").GetDecimal().ShouldBe(1640.00m);
        removed.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(19687.50m);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("expenses").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task AnExpenseIdFromAnotherOrderIsNeverFoundOnEditOrRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var firstWithExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, first, today, OrderFixtures.FabricId, 100m, manager.UserId);
        var foreignId = firstWithExpense.GetProperty("expenses")[0].GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            second.GetProperty("id").GetGuid(),
            foreignId,
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 50m, manager.UserId, second.GetProperty("version").GetString()));
        using var remove = await OrderFixtures.DeleteExpenseAsync(client, manager.AccessToken, second.GetProperty("id").GetGuid(), foreignId);

        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.expense-not-found");
        remove.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(remove, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.expense-not-found");
        var stillThere = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, first.GetProperty("id").GetGuid());
        stillThere.GetProperty("expenses")[0].GetProperty("amount").GetDecimal().ShouldBe(100m);
    }

    [Fact]
    public async Task ARetiredCategoryIsRefusedOnAddAndOnSwitchButAKeptRetiredCategoryMayBeEdited()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var category = await OrderFixtures.AddExpenseCategoryAsync(database, retired: false);
        var retiredElsewhere = await OrderFixtures.AddExpenseCategoryAsync(database, retired: true);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, category, 500m, manager.UserId);
        var id = withExpense.GetProperty("id").GetGuid();
        var expenseId = withExpense.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        await OrderFixtures.RetireExpenseCategoryAsync(database, category);
        var version = withExpense.GetProperty("version").GetString();

        using var add = await OrderFixtures.AddExpenseAsync(client, manager.AccessToken, id, OrderFixtures.ExpenseBody(today, retiredElsewhere, null, 100m, manager.UserId, version));
        using var switched = await OrderFixtures.PutExpenseAsync(client, manager.AccessToken, id, expenseId, OrderFixtures.ExpenseBody(today, retiredElsewhere, null, 500m, manager.UserId, version));
        using var kept = await OrderFixtures.PutExpenseAsync(client, manager.AccessToken, id, expenseId, OrderFixtures.ExpenseBody(today, category, null, 450m, manager.UserId, version));

        add.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(add, TestContext.Current.CancellationToken), "orderExpenseCategoryId")
            .ShouldBe(["This category was retired. Choose another one."]);
        switched.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        kept.StatusCode.ShouldBe(HttpStatusCode.OK, await kept.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("expenses")[0].GetProperty("category").GetProperty("retired").GetBoolean().ShouldBeTrue();
        stored.GetProperty("expenses")[0].GetProperty("amount").GetDecimal().ShouldBe(450m);
    }

    [Fact]
    public async Task EveryExpenseFieldRuleAnswersA400OnItsField()
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
            using var response = await OrderFixtures.AddExpenseAsync(client, manager.AccessToken, id, body);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            return OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), field);
        }

        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 0m, manager.UserId, version), "amount")).ShouldBe(["Enter an amount greater than ₱0.00."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 1_000_000.01m, manager.UserId, version), "amount")).ShouldBe(["Enter an amount of ₱1,000,000.00 or less."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 0.001m, manager.UserId, version), "amount")).ShouldBe(["Use at most 2 decimal places."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today.AddDays(31), OrderFixtures.FabricId, null, 100m, manager.UserId, version), "expenseDate"))
            .ShouldBe([$"Choose a date up to 30 days from today, {today.AddDays(30).ToString("MMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture)} at the latest."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(null, OrderFixtures.FabricId, null, 100m, manager.UserId, version), "expenseDate")).ShouldBe(["Enter the date."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, new string('d', 201), 100m, manager.UserId, version), "description"))
            .ShouldBe(["Keep the description to 200 characters or fewer."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, null, null, 100m, manager.UserId, version), "orderExpenseCategoryId")).ShouldBe(["Choose a category."]);
        (await ErrorsAsync(OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, null, version), "paidByUserId")).ShouldBe(["Choose who paid."]);
    }

    [Fact]
    public async Task ADateThirtyDaysAheadAndADateLongAgoAreAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        var ahead = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today.AddDays(30), OrderFixtures.FabricId, 100m, manager.UserId);
        var longAgo = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, ahead, today.AddDays(-700), OrderFixtures.FabricId, 100m, manager.UserId);

        longAgo.GetProperty("expenses").GetArrayLength().ShouldBe(2);
    }

    [Fact]
    public async Task AStaleVersionOnAddOrEditIs409AndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, OrderFixtures.FabricId, 500m, manager.UserId);
        var id = withExpense.GetProperty("id").GetGuid();

        using var add = await OrderFixtures.AddExpenseAsync(
            client, manager.AccessToken, id, OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, manager.UserId, created.GetProperty("version").GetString()));
        using var edit = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            id,
            withExpense.GetProperty("expenses")[0].GetProperty("id").GetGuid(),
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 300m, manager.UserId, created.GetProperty("version").GetString()));

        add.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        edit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("expenses").GetArrayLength().ShouldBe(1);
        stored.GetProperty("expenses")[0].GetProperty("amount").GetDecimal().ShouldBe(500m);
    }

    private static async Task<JsonElement> Ord0148WithDiscountAsync(HttpClient client, string token, DateOnly today)
    {
        var created = await OrderFixtures.CreateAsync(client, token, OrderFixtures.Ord0148ItemsBody(today));
        return await OrderFixtures.AddDiscountAndReadAsync(client, token, created, "percentage", 5m);
    }
}
