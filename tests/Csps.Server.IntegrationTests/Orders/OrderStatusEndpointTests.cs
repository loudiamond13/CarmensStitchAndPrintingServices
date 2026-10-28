using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

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
