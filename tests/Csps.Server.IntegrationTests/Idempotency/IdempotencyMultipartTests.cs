using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>
/// SEC-06, LIB-CR-02, ORD-04, T-09-28, T-09-30: a photo upload sent again with the same Idempotency-Key replays the first answer even when the
/// multipart boundary changed, because the hash covers each part and not the boundary. Changed bytes or fields under a used key are a 422.
/// </summary>
public sealed class IdempotencyMultipartTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task TheSamePhotoWithANewBoundaryAndTheSameKeyReplaysTheAnswerAndStoresOnePhoto()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, manager.AccessToken, id, key, "boundary-one", [MultipartPart.Upload("file", Photo)]);
        using var second = await SendAsync(client, manager.AccessToken, id, key, "boundary-two", [MultipartPart.Upload("file", Photo)]);

        first.StatusCode.ShouldBe(HttpStatusCode.OK, await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        second.StatusCode.ShouldBe(HttpStatusCode.OK, await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        second.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe(await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem();
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheSameKeyWithOneByteChangedAnswers422AndStoresNothingMore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var key = Guid.NewGuid();
        var changed = (byte[])Photo.Clone();
        changed[^3] ^= 0x01;

        using var first = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo)]);
        using var second = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", changed)]);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        await ShouldBeMismatchAsync(second);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheSameBytesWithADifferentDescriptionUnderOneKeyAnswer422()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo), MultipartPart.Text("description", "Front")]);
        using var second = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo), MultipartPart.Text("description", "Back")]);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        await ShouldBeMismatchAsync(second);
    }

    [Fact]
    public async Task TheSameBytesUnderADifferentFileNameOrPartTypeAnswer422()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo, "front.jpg")]);
        using var renamed = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo, "back.jpg")]);
        using var retyped = await SendAsync(client, manager.AccessToken, id, key, "same", [MultipartPart.Upload("file", Photo, "front.jpg", "image/png")]);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        await ShouldBeMismatchAsync(renamed);
        await ShouldBeMismatchAsync(retyped);
    }

    [Fact]
    public async Task AnotherOrderUnderTheSameKeyAndBytesIsNotAReplay()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var first = await CreateOrderAsync(factory, client, manager.AccessToken);
        var other = await CreateOrderAsync(factory, client, manager.AccessToken);
        var key = Guid.NewGuid();

        using var sentFirst = await SendAsync(client, manager.AccessToken, first, key, "same", [MultipartPart.Upload("file", Photo)]);
        using var sentOther = await SendAsync(client, manager.AccessToken, other, key, "same", [MultipartPart.Upload("file", Photo)]);

        sentFirst.StatusCode.ShouldBe(HttpStatusCode.OK);
        await ShouldBeMismatchAsync(sentOther);
    }

    [Fact]
    public async Task ABodyThatIsNotValidMultipartIsHashedRawAndTheActionAnswers400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await SendRawAsync(client, manager.AccessToken, id, Guid.NewGuid(), "no-such-boundary", Encoding.UTF8.GetBytes("this is not a multipart body"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AMultipartContentTypeWithAnOverlongBoundaryIsHashedRawAndTheActionAnswers400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var boundary = new string('b', 300);

        using var response = await SendRawAsync(client, manager.AccessToken, id, Guid.NewGuid(), boundary, MultipartBodies.Build(boundary, [MultipartPart.Upload("file", Photo)]));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    private static async Task ShouldBeMismatchAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("idempotency.key-mismatch");
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string accessToken, Guid orderId, Guid key, string boundary, MultipartPart[] parts) =>
        SendRawAsync(client, accessToken, orderId, key, boundary, MultipartBodies.Build(boundary, parts));

    private static async Task<HttpResponseMessage> SendRawAsync(HttpClient client, string accessToken, Guid orderId, Guid key, string boundary, byte[] body)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, key.ToString("D"));
        using var content = new ByteArrayContent(body);
        content.Headers.ContentType = new MediaTypeHeaderValue("multipart/form-data") { Parameters = { new NameValueHeaderValue("boundary", boundary) } };
        request.Content = content;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
