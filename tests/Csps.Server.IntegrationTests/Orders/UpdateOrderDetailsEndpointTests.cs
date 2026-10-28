using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-08, SEC-07, SEC-08, D-22, D-25: any staff member edits an order's details with the version they opened; the next read shows the change.</summary>
public sealed class UpdateOrderDetailsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";

    [Fact]
    public async Task AnAdminChangesTheDueDateOfAnOrderAManagerRecordedAndTheNextReadShowsIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["dueDate"] = OrderFixtures.Date(today.AddDays(21));
        var before = TimeProvider.System.GetUtcNow();

        using var response = await OrderFixtures.PutDetailsAsync(client, admin.AccessToken, id, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("id").GetGuid().ShouldBe(id);
        saved.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(21)));
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        saved.GetProperty("lastChangedAt").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        saved.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(21)));
        read.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
        read.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        read.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task ASaveWithAnOlderVersionIsRefusedWithTheStaleMessageAndStoresNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var firstEdit = OrderFixtures.DetailsBodyFrom(created);
        firstEdit["dueDate"] = OrderFixtures.Date(today.AddDays(20));
        using (var accepted = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, firstEdit))
        {
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var late = OrderFixtures.DetailsBodyFrom(created);
        late["dueDate"] = OrderFixtures.Date(today.AddDays(30));
        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, late);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        problem.GetProperty("detail").GetString().ShouldBe(StaleDetail);
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(20)));
    }

    [Fact]
    public async Task AnUnknownIdAnswers404WithTheOrderNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, Guid.NewGuid(), OrderFixtures.DetailsBodyFrom(created));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.PutDetailsAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AManagerEditsAnOrderAnAdminRecordedAndTheOtherWayRound()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        var byManager = OrderFixtures.DetailsBodyFrom(created);
        byManager["notes"] = "Manager note";
        using var first = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, byManager);
        first.StatusCode.ShouldBe(HttpStatusCode.OK, await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var afterManager = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        afterManager.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var byAdmin = OrderFixtures.DetailsBodyFrom(afterManager);
        byAdmin["notes"] = "Admin note";
        using var second = await OrderFixtures.PutDetailsAsync(client, admin.AccessToken, id, byAdmin);
        second.StatusCode.ShouldBe(HttpStatusCode.OK, await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var afterAdmin = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        afterAdmin.GetProperty("notes").GetString().ShouldBe("Admin note");
        afterAdmin.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        afterAdmin.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        afterAdmin.TryGetProperty("canEdit", out _).ShouldBeFalse();
    }

    [Fact]
    public async Task AnEmptyCustomerNameIsA400OnCustomerNameAndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["customerName"] = " ";

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["customerName"]);
        OrderFixtures.FieldErrors(problem, "customerName").ShouldBe(["Enter the customer's name."]);
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        stored.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task EveryDetailsRuleAppliesOnEditAndTheDueDateIsRequired()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["dueDate"] = null;
        body["contactNumber"] = "call me";
        body["email"] = "not an email";
        body["notes"] = new string('n', 2001);

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["contactNumber", "dueDate", "email", "notes"]);
        OrderFixtures.FieldErrors(problem, "dueDate").ShouldBe(["Enter the due date."]);
        OrderFixtures.FieldErrors(problem, "contactNumber").ShouldBe(["Use digits, spaces and + - ( ) only."]);
    }

    [Fact]
    public async Task AMalformedVersionIsA400OnVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["version"] = "%%%";

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["version"]);
        OrderFixtures.FieldErrors(problem, "version").ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task ASaveThatChangesNothingAnswers200WithTheSameVersionAndNoLastChanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, OrderFixtures.DetailsBodyFrom(created));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        OrderFixtures.IsNull(document.RootElement, "lastChangedBy").ShouldBeTrue();
        OrderFixtures.IsNull(document.RootElement, "lastChangedAt").ShouldBeTrue();
    }

    [Fact]
    public async Task ForgedAttributionNumberStatusAndTotalsInTheBodyAreIgnored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var editor = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, other.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["notes"] = "Edited";
        body["updatedById"] = other.UserId;
        body["createdById"] = other.UserId;
        body["lastChangedBy"] = other.UserId;
        body["updatedAt"] = "1999-01-01T00:00:00Z";
        body["number"] = "ORD-1999-9999";
        body["status"] = "cancelled";
        body["total"] = 1.00m;
        body["items"] = Array.Empty<object>();

        using var response = await OrderFixtures.PutDetailsAsync(client, editor.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, editor.AccessToken, id);
        stored.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(editor.UserId);
        stored.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(other.UserId);
        stored.GetProperty("number").GetString().ShouldBe(created.GetProperty("number").GetString());
        stored.GetProperty("status").GetString().ShouldBe("pending");
        stored.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(9750.00m);
        stored.GetProperty("items").GetArrayLength().ShouldBe(1);
    }

    [Fact]
    public async Task ASoftDeletedOrderAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            var marked = await context.Orders.IgnoreQueryFilters(["SoftDelete"])
                .Where(order => order.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(order => order.DeletedAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
            marked.ShouldBe(1);
        }

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, OrderFixtures.DetailsBodyFrom(created));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task ARealChangeWritesExactlyOneChangedEntryForTheOrderWithNoCustomerText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var editor = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = OrderFixtures.DetailsBodyFrom(created);
        body["dueDate"] = OrderFixtures.Date(today.AddDays(21));
        body["customerName"] = "Private Customer";
        body["notes"] = "Private rush note";

        using var response = await OrderFixtures.PutDetailsAsync(client, editor.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.Action == "order.changed" && row.TargetId == id.ToString("D"), TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("Order");
        entry.ActorUserId.ShouldBe(editor.UserId);
        entry.Detail.ShouldBe($"dueDate={OrderFixtures.Date(today.AddDays(14))}>{OrderFixtures.Date(today.AddDays(21))};fields=customerName,notes");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
        entry.Detail.ShouldNotContain("Juan", Case.Insensitive);
    }

    [Fact]
    public async Task ASaveThatChangesNothingWritesNoChangedEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, OrderFixtures.DetailsBodyFrom(created));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.Action == "order.changed" && row.TargetId == id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AStaleOrRefusedSaveWritesNoChangedEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var stale = OrderFixtures.DetailsBodyFrom(created);
        stale["notes"] = "Stale";
        stale["version"] = "AAAAAAAAAAE=";
        var refused = OrderFixtures.DetailsBodyFrom(created);
        refused["customerName"] = string.Empty;

        using var staleResponse = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, stale);
        using var refusedResponse = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, refused);

        staleResponse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        refusedResponse.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.Action == "order.changed" && row.TargetId == id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBe(0);
    }
}
