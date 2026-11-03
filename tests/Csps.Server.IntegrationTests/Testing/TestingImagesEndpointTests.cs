using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// IMG-01, D-07, QUAL-05: in the Testing environment of a Debug build the fake photo store serves its bytes at
/// <c>GET /api/testing/images/{id}</c> and can be told to fail the next uploads, so end-to-end runs never call Cloudinary.
/// </summary>
public sealed class TestingImagesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/images";

    [Fact]
    public async Task AnUploadedPhotoComesBackFromTheItsOwnAddressWithTheStoredContentType()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var orderId = await CreateOrderAsync(factory, client, manager.AccessToken);
        var photo = SyntheticImages.Jpeg(640, 480);

        using var upload = await UploadAsync(client, manager.AccessToken, orderId, photo);
        var uploadText = await upload.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        upload.StatusCode.ShouldBe(HttpStatusCode.OK, uploadText);
        using var document = JsonDocument.Parse(uploadText);
        var address = document.RootElement.GetProperty("images").EnumerateArray().ShouldHaveSingleItem().GetProperty("thumb").GetProperty("src").GetString().ShouldNotBeNull();
        address.ShouldStartWith(Route + "/");

        using var response = await client.GetAsync(new Uri(address, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("image/jpeg");
        (await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(photo);
    }

    [Fact]
    public async Task AnUnknownIdAnswers404()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri($"{Route}/{Guid.NewGuid():N}?size=thumb", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task FailNextWithCountOneMakesTheNextUploadAnswer503AndTheOneAfterSucceed()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var orderId = await CreateOrderAsync(factory, client, manager.AccessToken);
        var photo = SyntheticImages.Jpeg(640, 480);

        using var armed = await client.PostAsJsonAsync(new Uri($"{Route}/fail-next", UriKind.Relative), new { count = 1 }, TestContext.Current.CancellationToken);
        armed.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var failed = await UploadAsync(client, manager.AccessToken, orderId, photo);
        failed.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        (await ProblemJson.ReadAsync(failed, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("images.storage-failed");

        using var next = await UploadAsync(client, manager.AccessToken, orderId, photo);
        next.StatusCode.ShouldBe(HttpStatusCode.OK, await next.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("""{ "count": -1 }""")]
    [InlineData("""{ "count": 1000 }""")]
    [InlineData("""{ }""")]
    [InlineData("not json")]
    public async Task AMissingOrOutOfRangeCountAnswers400(string body)
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(new Uri($"{Route}/fail-next", UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
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
