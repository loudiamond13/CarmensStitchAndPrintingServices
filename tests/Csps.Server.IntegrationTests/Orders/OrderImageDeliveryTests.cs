using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-04, IMG-04, D-01, D-04: every order answer lists its photos in position order with ready, sized addresses.</summary>
public sealed class OrderImageDeliveryTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/images/";

    [Fact]
    public async Task TheUploadAnswerAndTheOrderReadCarryTheSamePhotoWithItsThumbViewerAndFullSizeAddresses()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var upload = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.Jpeg(4000, 3000));
        var uploadText = await upload.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        upload.StatusCode.ShouldBe(HttpStatusCode.OK, uploadText);
        var photoId = storage.Uploads.ShouldHaveSingleItem().PublicId.Split('/')[^1];
        using var uploadDocument = JsonDocument.Parse(uploadText);
        AssertPhoto(uploadDocument.RootElement.GetProperty("images").EnumerateArray().ShouldHaveSingleItem(), photoId);

        using var read = await OrderFixtures.GetAsync(client, manager.AccessToken, id);
        var readText = await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        read.StatusCode.ShouldBe(HttpStatusCode.OK, readText);
        using var readDocument = JsonDocument.Parse(readText);
        AssertPhoto(readDocument.RootElement.GetProperty("images").EnumerateArray().ShouldHaveSingleItem(), photoId);
    }

    [Fact]
    public async Task ASoftDeletedOrderStillAnswersItsPhotosWithTheSameAddresses()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, admin.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        using (var upload = await UploadAsync(client, admin.AccessToken, id, SyntheticImages.Jpeg(4000, 3000)))
        {
            upload.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var read = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);

        var text = await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        read.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var photo = document.RootElement.GetProperty("order").GetProperty("images").EnumerateArray().ShouldHaveSingleItem();
        AssertPhoto(photo, storage.Uploads.ShouldHaveSingleItem().PublicId.Split('/')[^1]);
    }

    [Fact]
    public async Task ThreeUploadsComeBackAtPositionsZeroOneAndTwoAndAnOrderWithNoPhotosAnswersAnEmptyList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        using (var empty = await OrderFixtures.GetAsync(client, manager.AccessToken, id))
        {
            using var emptyDocument = JsonDocument.Parse(await empty.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            emptyDocument.RootElement.GetProperty("images").GetArrayLength().ShouldBe(0);
        }

        for (var count = 0; count < 3; count++)
        {
            using var upload = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.Jpeg(800 + count, 600));
            upload.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var read = await OrderFixtures.GetAsync(client, manager.AccessToken, id);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var photos = document.RootElement.GetProperty("images").EnumerateArray().ToList();
        photos.Select(photo => photo.GetProperty("position").GetInt32()).ShouldBe([0, 1, 2]);
        photos.Select(photo => photo.GetProperty("width").GetInt32()).ShouldBe([800, 801, 802]);
    }

    private static void AssertPhoto(JsonElement photo, string photoId)
    {
        string Address(string size) => $"{Route}{photoId}?size={size}";

        photo.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        photo.GetProperty("position").GetInt32().ShouldBe(0);
        photo.GetProperty("description").ValueKind.ShouldBe(JsonValueKind.Null);
        photo.GetProperty("width").GetInt32().ShouldBe(4000);
        photo.GetProperty("height").GetInt32().ShouldBe(3000);

        var thumb = photo.GetProperty("thumb");
        thumb.GetProperty("src").GetString().ShouldBe(Address("csps_sq_88"));
        thumb.GetProperty("srcSet").GetString().ShouldBe($"{Address("csps_sq_88")} 1x, {Address("csps_sq_176")} 2x");

        var viewer = photo.GetProperty("viewer");
        viewer.GetProperty("src").GetString().ShouldBe(Address("csps_view_960"));
        viewer.GetProperty("srcSet").GetString().ShouldBe(
            $"{Address("csps_view_640")} 640w, {Address("csps_view_960")} 960w, {Address("csps_view_1280")} 1280w, {Address("csps_view_1600")} 1600w");

        photo.GetProperty("fullSize").GetString().ShouldBe(Address("csps_full_2000"));
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId, byte[] file)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(file);
        part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        form.Add(part, "file", "photo.jpg");
        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
