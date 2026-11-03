using System.Net;
using System.Net.Http.Headers;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>IMG-02, IMG-03, D-34, T-09-13, T-09-15: the upload recognizes PNG, WebP and HEIC by their bytes, stores the upright size, and refuses look-alikes whatever the file name or content type says.</summary>
public sealed class OrderImageTypesTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task APngMockupIsStoredWithFormatPngAndItsTrueSize()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var png = SyntheticImages.Png(800, 600);

        using var response = await UploadAsync(client, manager.AccessToken, id, png, "mockup.png", "image/png");

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem().Length.ShouldBe(png.Length);
        var row = await ReadSingleRowAsync(id);
        row.Format.ShouldBe("png");
        row.Width.ShouldBe(800);
        row.Height.ShouldBe(600);
        row.Bytes.ShouldBe(png.Length);
    }

    [Theory]
    [InlineData(5000, 5000, true)]
    [InlineData(5001, 5000, false)]
    public async Task APngOfFiveThousandBySquareIsAcceptedAndOneMorePixelAcrossIsRefused(int width, int height, bool accepted)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.Png(width, height), "print.png", "image/png");

        if (accepted)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ReadSingleRowAsync(id)).Width.ShouldBe(width);
            return;
        }

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.too-big");
        OrderFixtures.FieldErrors(problem, "file").ShouldBe(["print.png is too big. Photos can be at most 25 megapixels."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
    }

    private async Task<OrderImage> ReadSingleRowAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        return await context.Set<OrderImage>().AsNoTracking().SingleAsync(image => image.OrderId == orderId, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId, byte[] file, string fileName, string contentType)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(file);
        part.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(part, "file", fileName);
        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
