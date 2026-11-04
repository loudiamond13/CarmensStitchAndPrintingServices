using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-04, D-11 to D-15, D-19: staff move photos, choose the cover and describe photos, each change guarded by the order's version.</summary>
public sealed class OrderImageArrangeEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task MovingTheSecondPhotoToTheFrontMakesItTheCoverAndAnswersTheWholeOrderWithANewVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, order.GetProperty("version").GetString());
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var answered = document.RootElement;
        DescriptionsInOrder(answered).ShouldBe(["B", "A", "C"]);
        answered.GetProperty("images").EnumerateArray().Select(image => image.GetProperty("position").GetInt32()).ShouldBe([0, 1, 2]);
        answered.GetProperty("version").GetString().ShouldNotBe(order.GetProperty("version").GetString());

        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).OrderBy(row => row.Position).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Id).ShouldBe([photos["B"], photos["A"], photos["C"]]);
        rows.Select(row => row.Slot).Order().ShouldBe([0, 1, 2]);
        var audit = await context.AuditLog.AsNoTracking().Where(entry => entry.TargetId == id.ToString("D") && entry.Action == "order-image.cover-changed").SingleAsync(TestContext.Current.CancellationToken);
        audit.Action.ShouldBe("order-image.cover-changed");
        audit.TargetType.ShouldBe("Order");
        audit.ActorUserId.ShouldBe(manager.UserId);
        audit.Detail.ShouldBe($"number={number};cover=2");

        var listed = (await OrderFixtures.ReadListAsync(client, manager.AccessToken, $"q={number}")).GetProperty("items").EnumerateArray().Single();
        listed.GetProperty("cover").GetProperty("width").GetInt32().ShouldBe(800);
    }

    [Fact]
    public async Task TheOldVersionAnswers409StaleAndThePositionsStay()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var oldVersion = order.GetProperty("version").GetString();
        using (var first = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, oldVersion))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var stale = await PutPositionAsync(client, manager.AccessToken, id, photos["C"], 0, oldVersion);

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).OrderBy(row => row.Position).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Id).ShouldBe([photos["B"], photos["A"], photos["C"]]);
    }

    private static string[] DescriptionsInOrder(JsonElement order) =>
        [.. order.GetProperty("images").EnumerateArray().Select(image => image.GetProperty("description").GetString()!)];

    private static Dictionary<string, Guid> PhotosByDescription(JsonElement order) =>
        order.GetProperty("images").EnumerateArray().ToDictionary(image => image.GetProperty("description").GetString()!, image => image.GetProperty("id").GetGuid());

    private static async Task<JsonElement> OrderWithThreePhotosAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        JsonElement latest = created;
        foreach (var (name, width, height) in new[] { ("A", 640, 480), ("B", 800, 600), ("C", 320, 240) })
        {
            using var response = await UploadAsync(client, accessToken, id, SyntheticImages.Jpeg(width, height), name);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            using var document = JsonDocument.Parse(text);
            latest = document.RootElement.Clone();
        }

        return latest;
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId, byte[] file, string description)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(file);
        part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        form.Add(part, "file", "photo.jpg");
        form.Add(new StringContent(description), "description");
        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PutPositionAsync(HttpClient client, string? accessToken, Guid orderId, Guid imageId, int? position, string? version)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/images/{imageId:D}/position", accessToken);
        request.Content = JsonContent.Create(new Dictionary<string, object?> { ["position"] = position, ["version"] = version });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
