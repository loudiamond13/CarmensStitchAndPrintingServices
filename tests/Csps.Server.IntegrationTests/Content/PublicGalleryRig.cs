using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// A host and a Manager for the public gallery tests. The six migrated lines are put back, the Basketball and Volleyball Jersey product
/// types are filed under their lines, and every call goes through the real routes: an order is created, photographed and shown the way
/// staff do it.
/// </summary>
internal sealed class PublicGalleryRig : IAsyncDisposable
{
    public const string GalleryRoute = "/api/v1/public/gallery";

    private PublicGalleryRig(CspsDatabase database, CspsApiFactory factory, StartedSession manager)
    {
        Database = database;
        Factory = factory;
        Manager = manager;
    }

    public CspsDatabase Database { get; }

    public CspsApiFactory Factory { get; }

    public StartedSession Manager { get; }

    public static Guid LineId(string key) => ProductLineSeed.All.Single(entry => entry.Key == key).Id;

    public static async Task<PublicGalleryRig> StartAsync(CspsDatabase database)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var types = await context.ProductTypes.ToListAsync(TestContext.Current.CancellationToken);
            types.Single(row => row.Id == OrderFixtures.BasketballId).LinkToLine(LineId("basketball"));
            types.Single(row => row.Name == "Volleyball Jersey").LinkToLine(LineId("volleyball"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        return new PublicGalleryRig(database, factory, await TestSessions.StartAsync(factory, Roles.Manager));
    }

    public async ValueTask DisposeAsync() => await Factory.DisposeAsync();

    /// <summary>Creates an order with the given team and item quantities (Basketball Jersey), not yet shown.</summary>
    public async Task<JsonElement> CreateOrderAsync(string team, params int[] quantities)
    {
        using var client = Factory.CreateClient();
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, await OrderFixtures.TodayAsync(Factory));
        body["teamName"] = team;
        body["items"] = quantities.Select(quantity => OrderFixtures.Item(OrderFixtures.BasketballId, "Sample piece", null, quantity, 0.00m)).ToArray();
        return await OrderFixtures.CreateAsync(client, Manager.AccessToken, body);
    }

    /// <summary>Uploads one synthetic photo to an order.</summary>
    public async Task UploadPhotoAsync(Guid orderId, int width, int height)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", Manager.AccessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("gallery-boundary", [MultipartPart.Upload("file", SyntheticImages.Jpeg(width, height))]);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    /// <summary>Records the customer's OK and sets whether the order shows, then returns the saved detail.</summary>
    public async Task<JsonElement> SavePublicAsync(Guid orderId, bool consent, bool show, string? name = null, Guid? lineId = null)
    {
        using var client = Factory.CreateClient();
        var order = await OrderFixtures.ReadDetailAsync(client, Manager.AccessToken, orderId);
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/public", Manager.AccessToken);
        request.Content = JsonContent.Create(new Dictionary<string, object?>
        {
            ["version"] = order.GetProperty("version").GetString(),
            ["customerConsent"] = consent,
            ["showOnWebsite"] = show,
            ["productLineId"] = lineId,
            ["publicName"] = name,
        });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Creates an order, adds the photos and shows it.</summary>
    public async Task<Guid> ShowOrderAsync(string team, int[] quantities, params (int Width, int Height)[] photos)
    {
        var created = await CreateOrderAsync(team, quantities);
        var id = created.GetProperty("id").GetGuid();
        foreach (var (width, height) in photos)
        {
            await UploadPhotoAsync(id, width, height);
        }

        await SavePublicAsync(id, consent: true, show: true);
        return id;
    }

    /// <summary>Hides a product line through the Manager route.</summary>
    public async Task<HttpResponseMessage> HideLineAsync(Guid lineId)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/product-lines/{lineId:D}/hide", Manager.AccessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Deletes a product line through the Manager route.</summary>
    public async Task<HttpResponseMessage> DeleteLineAsync(Guid lineId)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Delete, $"/api/v1/product-lines/{lineId:D}", Manager.AccessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the Manager's list of product lines.</summary>
    public async Task<List<LineListItem>> ListLinesAsync()
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Get, "/api/v1/product-lines", Manager.AccessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<List<LineListItem>>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    /// <summary>Makes the photo at a place in the order's list the cover.</summary>
    public async Task MakeCoverAsync(Guid orderId, int photoIndex)
    {
        using var client = Factory.CreateClient();
        var order = await OrderFixtures.ReadDetailAsync(client, Manager.AccessToken, orderId);
        var photoId = order.GetProperty("images")[photoIndex].GetProperty("id").GetGuid();
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/images/{photoId:D}/position", Manager.AccessToken);
        request.Content = JsonContent.Create(new Dictionary<string, object?> { ["position"] = 0, ["version"] = order.GetProperty("version").GetString() });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    /// <summary>Reads the anonymous gallery answer and its ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> GalleryAsync() => await ReadAsync(GalleryRoute);

    /// <summary>Reads the anonymous Home answer and its ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> PublicHomeAsync() => await ReadAsync("/api/v1/public/home");

    /// <summary>Reads any anonymous public route as JSON with its ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> ReadAsync(string route)
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync(new Uri(route, UriKind.Relative), TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        return (JsonDocument.Parse(text), response.Headers.ETag.ShouldNotBeNull().ToString());
    }
}
