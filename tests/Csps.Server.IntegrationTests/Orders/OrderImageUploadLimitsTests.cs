using System.Net;
using System.Text.Json;
using Csps.Application.Images;
using Csps.Application.Security;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>IMG-02, SEC-03, T-09-26: a full-size phone photo reaches the upload action; one byte over the upload body limit is refused with a 413 before the action runs.</summary>
public sealed class OrderImageUploadLimitsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Boundary = "csps-limit-boundary";
    private const int EightMegabytes = 8 * 1024 * 1024;

    [Fact]
    public async Task AnEightMegabytePhotoIsUploadedAndStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var photo = PaddedJpeg(EightMegabytes);

        using var response = await UploadAsync(client, manager.AccessToken, id, MultipartBodies.Build(Boundary, [MultipartPart.Upload("file", photo)]));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem().Length.ShouldBe(photo.Length);
    }

    [Fact]
    public async Task ABodyOneByteOverTheUploadLimitIsRefusedAs413BeforeTheActionRuns()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, BodyOfExactly(ImageUploadLimits.BodyBytes + 1));

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(413);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ABodyOfExactlyTheUploadLimitReachesTheActionAndIsRefusedForItsContent()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);

        using var response = await UploadAsync(client, manager.AccessToken, id, BodyOfExactly(ImageUploadLimits.BodyBytes));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    // A JPEG whose scan data is padded with zero bytes, so the whole file has the given length.
    private static byte[] PaddedJpeg(int length)
    {
        var small = SyntheticImages.Jpeg(640, 480);
        var photo = new byte[length];
        small.AsSpan(0, small.Length - 2).CopyTo(photo);
        photo[^2] = 0xFF;
        photo[^1] = 0xD9;
        return photo;
    }

    // A multipart body with one file part of filler bytes (not a photo) and exactly the wanted total length.
    private static byte[] BodyOfExactly(int total)
    {
        var overhead = MultipartBodies.Build(Boundary, [MultipartPart.Upload("file", [])]).Length;
        return MultipartBodies.Build(Boundary, [MultipartPart.Upload("file", new byte[total - overhead])]);
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        JsonElement created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId, byte[] body)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        using var content = new ByteArrayContent(body);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("multipart/form-data") { Parameters = { new System.Net.Http.Headers.NameValueHeaderValue("boundary", Boundary) } };
        request.Content = content;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
