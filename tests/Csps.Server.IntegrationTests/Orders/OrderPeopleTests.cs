using System.Net;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-22, ORD-23, D-32, D-49, T-07-29, T-07-32: only an active, set-up Admin or Manager may be named as who received a payment or paid an expense, and a saved person may stay.</summary>
public sealed class OrderPeopleTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Refusal = "This person can't be chosen because their account isn't active. Choose someone else.";
    private static readonly string TemporaryPassword = $"Tmp-{Guid.NewGuid():N}!x";

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    [InlineData("no-role")]
    [InlineData("temporary-not-signed-in")]
    [InlineData("legacy-holder")]
    public async Task APersonWhoCannotBeChosenIsRefusedOnAddOnAReceiverChangeAndInTheFullCreate(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var candidate = await PrepareAsync(factory, client, manager.AccessToken, state);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var addResponse = await OrderFixtures.AddPaymentAsync(
            client,
            manager.AccessToken,
            id,
            OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, candidate, created.GetProperty("version").GetString()));
        await ExpectRefusalAsync(addResponse, "receivedByUserId");

        var withPayment = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 100m, OrderFixtures.CashId, manager.UserId);
        var paymentId = withPayment.GetProperty("payments")[0].GetProperty("id").GetGuid();
        using var changeResponse = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            id,
            paymentId,
            OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, candidate, withPayment.GetProperty("version").GetString()));
        await ExpectRefusalAsync(changeResponse, "receivedByUserId");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("payments")[0].GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, manager.UserId),
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, candidate),
        };
        using var createResponse = await OrderFixtures.PostAsync(client, manager.AccessToken, body);
        await ExpectRefusalAsync(createResponse, "payments[1].receivedByUserId");
    }

    [Fact]
    public async Task AnActiveAdminAndAnActiveManagerAreAcceptedOnAddOnAChangeAndInTheFullCreate()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        var byAdmin = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 100m, OrderFixtures.CashId, admin.UserId);
        var paymentId = byAdmin.GetProperty("payments")[0].GetProperty("id").GetGuid();
        using var changed = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            id,
            paymentId,
            OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, byAdmin.GetProperty("version").GetString()));

        changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("payments")[0].GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["payments"] = new[]
        {
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, admin.UserId),
            OrderFixtures.PaymentItem(today, 100m, OrderFixtures.CashId, manager.UserId),
        };
        using var createResponse = await OrderFixtures.PostAsync(client, manager.AccessToken, body);
        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created, await createResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AReceiverDeactivatedAfterThePaymentStillShowsAndThePaymentCanBeEditedWithoutChangingThem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var receiver = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Pia", "Perez", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var withPayment = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 500m, OrderFixtures.CashId, receiver.Id);
        withPayment.GetProperty("payments")[0].GetProperty("receivedByActive").GetBoolean().ShouldBeTrue();
        await AuthClient.DeactivateAsync(factory, receiver.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        var shown = after.GetProperty("payments")[0];
        shown.GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(receiver.Id);
        shown.GetProperty("receivedBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        shown.GetProperty("receivedByActive").GetBoolean().ShouldBeFalse();

        using var edit = await OrderFixtures.PutPaymentAsync(
            client,
            manager.AccessToken,
            id,
            shown.GetProperty("id").GetGuid(),
            OrderFixtures.PaymentBody(today, 450m, OrderFixtures.CashId, receiver.Id, after.GetProperty("version").GetString(), notes: "Corrected"));

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("payments")[0].GetProperty("amount").GetDecimal().ShouldBe(450m);
        stored.GetProperty("payments")[0].GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(receiver.Id);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action == "order-payment.receiver-changed", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AReceiverWhoWasDeletedKeepsTheirNameAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var receiver = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var withPayment = await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 500m, OrderFixtures.CashId, receiver.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, receiver.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, withPayment.GetProperty("id").GetGuid());

        var shown = after.GetProperty("payments")[0];
        shown.GetProperty("receivedBy").GetProperty("name").GetString().ShouldBe($"{receiver.FirstName} {receiver.LastName}");
        shown.GetProperty("receivedBy").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        shown.GetProperty("receivedByActive").GetBoolean().ShouldBeFalse();
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    [InlineData("no-role")]
    [InlineData("temporary-not-signed-in")]
    [InlineData("legacy-holder")]
    public async Task APersonWhoCannotBeChosenIsRefusedAsPayerOnAddOnAPayerChangeAndInTheFullCreate(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var candidate = await PrepareAsync(factory, client, manager.AccessToken, state);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var addResponse = await OrderFixtures.AddExpenseAsync(
            client,
            manager.AccessToken,
            id,
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, candidate, created.GetProperty("version").GetString()));
        await ExpectRefusalAsync(addResponse, "paidByUserId");

        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, OrderFixtures.FabricId, 100m, manager.UserId);
        var expenseId = withExpense.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        using var changeResponse = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            id,
            expenseId,
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, candidate, withExpense.GetProperty("version").GetString()));
        await ExpectRefusalAsync(changeResponse, "paidByUserId");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("expenses")[0].GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["expenses"] = new[]
        {
            OrderFixtures.ExpenseItem(today, OrderFixtures.FabricId, null, 100m, manager.UserId),
            OrderFixtures.ExpenseItem(today, OrderFixtures.FabricId, null, 100m, candidate),
        };
        using var createResponse = await OrderFixtures.PostAsync(client, manager.AccessToken, body);
        await ExpectRefusalAsync(createResponse, "expenses[1].paidByUserId");
    }

    [Fact]
    public async Task AnActiveAdminAndAnActiveManagerAreAcceptedAsPayerOnAddOnAChangeAndInTheFullCreate()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        var byAdmin = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, OrderFixtures.FabricId, 100m, admin.UserId);
        var expenseId = byAdmin.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        using var changed = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            id,
            expenseId,
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, manager.UserId, byAdmin.GetProperty("version").GetString()));

        changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("expenses")[0].GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["expenses"] = new[]
        {
            OrderFixtures.ExpenseItem(today, OrderFixtures.FabricId, null, 100m, admin.UserId),
            OrderFixtures.ExpenseItem(today, OrderFixtures.FabricId, null, 100m, manager.UserId),
        };
        using var createResponse = await OrderFixtures.PostAsync(client, manager.AccessToken, body);
        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created, await createResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task APayerDeactivatedAfterTheExpenseStillShowsAndTheExpenseCanBeEditedWithoutChangingThem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var payer = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Pia", "Perez", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, OrderFixtures.FabricId, 500m, payer.Id);
        withExpense.GetProperty("expenses")[0].GetProperty("paidByActive").GetBoolean().ShouldBeTrue();
        await AuthClient.DeactivateAsync(factory, payer.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        var shown = after.GetProperty("expenses")[0];
        shown.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.Id);
        shown.GetProperty("paidBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        shown.GetProperty("paidByActive").GetBoolean().ShouldBeFalse();

        using var edit = await OrderFixtures.PutExpenseAsync(
            client,
            manager.AccessToken,
            id,
            shown.GetProperty("id").GetGuid(),
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, "Corrected", 450m, payer.Id, after.GetProperty("version").GetString()));

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("expenses")[0].GetProperty("amount").GetDecimal().ShouldBe(450m);
        stored.GetProperty("expenses")[0].GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.Id);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action == "order-expense.payer-changed", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task APayerWhoWasDeletedKeepsTheirNameAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var payer = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var withExpense = await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, created, today, OrderFixtures.FabricId, 500m, payer.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, payer.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, withExpense.GetProperty("id").GetGuid());

        var shown = after.GetProperty("expenses")[0];
        shown.GetProperty("paidBy").GetProperty("name").GetString().ShouldBe($"{payer.FirstName} {payer.LastName}");
        shown.GetProperty("paidBy").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        shown.GetProperty("paidByActive").GetBoolean().ShouldBeFalse();
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    [InlineData("no-role")]
    [InlineData("temporary-not-signed-in")]
    [InlineData("legacy-holder")]
    public async Task APersonWhoCannotBeChosenIsRefusedAsRefunderOnAddAndOnARefunderChange(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var candidate = await PrepareAsync(factory, client, manager.AccessToken, state);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148FullBody(today, manager.UserId, manager.UserId));
        var id = created.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        using var addResponse = await OrderFixtures.AddRefundAsync(
            client,
            manager.AccessToken,
            id,
            OrderFixtures.RefundBody(today, 100m, "Order cancelled", candidate, cancelled.GetProperty("version").GetString()));
        await ExpectRefusalAsync(addResponse, "refundedByUserId");

        var withRefund = await OrderFixtures.AddRefundAndReadAsync(client, manager.AccessToken, cancelled, today, 100m, manager.UserId);
        var refundId = withRefund.GetProperty("refunds")[0].GetProperty("id").GetGuid();
        using var changeResponse = await OrderFixtures.PutRefundAsync(
            client,
            manager.AccessToken,
            id,
            refundId,
            OrderFixtures.RefundBody(today, 100m, "Order cancelled", candidate, withRefund.GetProperty("version").GetString()));
        await ExpectRefusalAsync(changeResponse, "refundedByUserId");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("refunds")[0].GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task AnActiveAdminAndAnActiveManagerAreAcceptedAsRefunderOnAddAndOnAChange()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148FullBody(today, manager.UserId, admin.UserId));
        var id = created.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        var byAdmin = await OrderFixtures.AddRefundAndReadAsync(client, manager.AccessToken, cancelled, today, 100m, admin.UserId);
        var refundId = byAdmin.GetProperty("refunds")[0].GetProperty("id").GetGuid();
        using var changed = await OrderFixtures.PutRefundAsync(
            client,
            manager.AccessToken,
            id,
            refundId,
            OrderFixtures.RefundBody(today, 100m, "Order cancelled", manager.UserId, byAdmin.GetProperty("version").GetString()));

        changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("refunds")[0].GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task ARefunderDeactivatedAfterTheRefundStillShowsAndTheRefundCanBeEditedWithoutChangingThem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var refunder = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Pia", "Perez", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148FullBody(today, manager.UserId, manager.UserId));
        var id = created.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");
        var withRefund = await OrderFixtures.AddRefundAndReadAsync(client, manager.AccessToken, cancelled, today, 500m, refunder.Id);
        withRefund.GetProperty("refunds")[0].GetProperty("refundedByActive").GetBoolean().ShouldBeTrue();
        await AuthClient.DeactivateAsync(factory, refunder.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        var shown = after.GetProperty("refunds")[0];
        shown.GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(refunder.Id);
        shown.GetProperty("refundedBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        shown.GetProperty("refundedByActive").GetBoolean().ShouldBeFalse();

        using var edit = await OrderFixtures.PutRefundAsync(
            client,
            manager.AccessToken,
            id,
            shown.GetProperty("id").GetGuid(),
            OrderFixtures.RefundBody(today, 450m, "Corrected", refunder.Id, after.GetProperty("version").GetString()));

        edit.StatusCode.ShouldBe(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("refunds")[0].GetProperty("amount").GetDecimal().ShouldBe(450m);
        stored.GetProperty("refunds")[0].GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(refunder.Id);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action == "order-refund.refunder-changed", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARefunderWhoWasDeletedKeepsTheirNameAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var refunder = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148FullBody(today, manager.UserId, manager.UserId));
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), "cancelled");
        var withRefund = await OrderFixtures.AddRefundAndReadAsync(client, manager.AccessToken, cancelled, today, 500m, refunder.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, refunder.Id);

        var after = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, withRefund.GetProperty("id").GetGuid());

        var shown = after.GetProperty("refunds")[0];
        shown.GetProperty("refundedBy").GetProperty("name").GetString().ShouldBe($"{refunder.FirstName} {refunder.LastName}");
        shown.GetProperty("refundedBy").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        shown.GetProperty("refundedByActive").GetBoolean().ShouldBeFalse();
    }

    private static async Task ExpectRefusalAsync(HttpResponseMessage response, string field)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe([field]);
        OrderFixtures.FieldErrors(problem, field).ShouldBe([Refusal]);
    }

    private async Task<Guid> PrepareAsync(CspsApiFactory factory, HttpClient client, string managerToken, string state)
    {
        if (state == "legacy-holder")
        {
            return LegacyHolder.Id;
        }

        if (state == "temporary-not-signed-in")
        {
            return await UserFixtures.CreateWithTemporaryPasswordAsync(client, managerToken, $"tia.{Guid.NewGuid():N}@example.com", TemporaryPassword);
        }

        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dee", "Dizon", Roles.Admin, withPassword: state != "invited");
        switch (state)
        {
            case "deactivated":
                await AuthClient.DeactivateAsync(factory, person.Id);
                break;
            case "manager-locked":
                await AccountStateFixtures.ManagerLockAsync(factory, person.Id);
                break;
            case "deleted":
                await AccountStateFixtures.MarkDeletedAsync(factory, person.Id);
                break;
            case "no-role":
                await using (var context = database.CreateContext())
                {
                    await context.UserRoles.Where(link => link.UserId == person.Id).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
                }

                break;
            default:
                break;
        }

        return person.Id;
    }
}
