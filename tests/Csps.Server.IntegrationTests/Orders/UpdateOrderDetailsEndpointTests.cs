using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

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
}
