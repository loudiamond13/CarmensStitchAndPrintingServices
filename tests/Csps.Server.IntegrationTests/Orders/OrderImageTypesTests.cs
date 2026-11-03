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

    [Theory]
    [InlineData(WebPKind.Lossy, 1024, 768)]
    [InlineData(WebPKind.Lossless, 300, 200)]
    [InlineData(WebPKind.Extended, 4000, 3000)]
    public async Task AWebPOfEachKindIsStoredWithFormatWebpAndItsTrueSize(WebPKind kind, int width, int height)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);

        using var response = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.WebP(kind, width, height), "shirt.webp", "image/webp");

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var row = await ReadSingleRowAsync(id);
        row.Format.ShouldBe("webp");
        row.Width.ShouldBe(width);
        row.Height.ShouldBe(height);
    }

    [Theory]
    [InlineData(null, 4032, 3024)]
    [InlineData(1, 3024, 4032)]
    [InlineData(2, 4032, 3024)]
    [InlineData(3, 3024, 4032)]
    public async Task AnIphoneHeicIsStoredUprightWithFormatHeic(int? rotation, int width, int height)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var heic = SyntheticImages.Heic(4032, 3024, rotation, exifOrientation: 6);

        using var response = await UploadAsync(client, manager.AccessToken, id, heic, "IMG_0001.HEIC", "image/heic");

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem().Length.ShouldBe(heic.Length);
        var row = await ReadSingleRowAsync(id);
        row.Format.ShouldBe("heic");
        row.Width.ShouldBe(width);
        row.Height.ShouldBe(height);
    }

    [Fact]
    public async Task AnAvifNamedAsAHeicIsRefusedWithTheTypeMessageAndNothingIsSentToStorage()
    {
        await RefuseAsync(SyntheticImages.Avif(), "photo.heic", "image/heic", "photo.heic");
    }

    [Fact]
    public async Task AnAnimatedWebPIsRefusedWithTheTypeMessage()
    {
        await RefuseAsync(SyntheticImages.WebP(WebPKind.Extended, 400, 300, SyntheticImages.WebPAnimation), "spin.webp", "image/webp", "spin.webp");
    }

    [Theory]
    [InlineData("svg")]
    [InlineData("gif")]
    [InlineData("bmp")]
    [InlineData("tiff")]
    public async Task OtherFileTypesAreRefusedWhateverTheirNameOrContentTypeSays(string kind)
    {
        var bytes = kind switch
        {
            "svg" => SyntheticImages.Svg(),
            "gif" => SyntheticImages.Gif(),
            "bmp" => SyntheticImages.Bmp(),
            _ => SyntheticImages.Tiff(),
        };

        await RefuseAsync(bytes, "logo.png", "image/png", "logo.png");
    }

    private async Task RefuseAsync(byte[] file, string fileName, string contentType, string shownName)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, file, fileName, contentType);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.type");
        OrderFixtures.FieldErrors(problem, "file").ShouldBe([$"{shownName} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(0);
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
