using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Csps.Application.Images;
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

/// <summary>D-02, IMG-03, T-09-31: what the image storage receives carries no location or camera data, the picture and its turn are kept, the stored byte count is the cleaned length, and a file that cannot be cleaned is refused with nothing stored.</summary>
public sealed class OrderImageMetadataTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] MetadataTexts =
    [
        SyntheticImages.FakeSerial,
        SyntheticImages.FakeMake,
        SyntheticImages.FakeModel,
        SyntheticImages.FakeDateTaken,
        SyntheticImages.FakeOwner,
        "ns.adobe.com",
        "Photoshop",
    ];

    [Fact]
    public async Task APhoneJpegWithGpsReachesStorageWithoutItsMetadataAndStaysUpright()
    {
        var phone = SyntheticImages.JpegWithMetadata(640, 480, orientation: 6);

        var (stored, row) = await UploadAndReadAsync(phone, "IMG_0001.JPG", "image/jpeg");

        AssertClean(stored.Bytes.Span);
        ContainsBytes(phone, [0x25, 0x88]).ShouldBeTrue("the fixture must carry the GPS pointer tag");
        ContainsBytes(stored.Bytes.Span, [0x25, 0x88]).ShouldBeFalse();
        var facts = ImageSniffer.Inspect(stored.Bytes.Span).ShouldNotBeNull();
        facts.Orientation.ShouldBe(6);
        facts.Width.ShouldBe(640);
        facts.Height.ShouldBe(480);
        row.Bytes.ShouldBe(stored.Bytes.Length);
        row.Bytes.ShouldBeLessThan(phone.Length);
        row.Width.ShouldBe(480);
        row.Height.ShouldBe(640);
        row.Format.ShouldBe("jpg");
    }

    [Fact]
    public async Task APngWithTextAndExifChunksReachesStorageWithoutThemAndKeepsItsSize()
    {
        var mockup = SyntheticImages.PngWithMetadata(800, 600);

        var (stored, row) = await UploadAndReadAsync(mockup, "mockup.png", "image/png");

        AssertClean(stored.Bytes.Span);
        ContainsBytes(stored.Bytes.Span, "TRAILER"u8).ShouldBeFalse();
        ContainsBytes(stored.Bytes.Span, "eXIf"u8).ShouldBeFalse();
        ContainsBytes(stored.Bytes.Span, "tEXt"u8).ShouldBeFalse();
        ImageSniffer.Inspect(stored.Bytes.Span).ShouldBe(ImageSniffer.Inspect(mockup));
        row.Bytes.ShouldBe(stored.Bytes.Length);
        row.Bytes.ShouldBeLessThan(mockup.Length);
        row.Format.ShouldBe("png");
        row.Width.ShouldBe(800);
        row.Height.ShouldBe(600);
    }

    [Fact]
    public async Task AWebPWithExifAndXmpChunksReachesStorageWithoutThemAndKeepsItsSize()
    {
        var photo = SyntheticImages.WebPWithMetadata(4000, 3000);

        var (stored, row) = await UploadAndReadAsync(photo, "shirt.webp", "image/webp");

        AssertClean(stored.Bytes.Span);
        ContainsBytes(stored.Bytes.Span, "EXIF"u8).ShouldBeFalse();
        ContainsBytes(stored.Bytes.Span, "XMP "u8).ShouldBeFalse();
        ImageSniffer.Inspect(stored.Bytes.Span).ShouldBe(ImageSniffer.Inspect(photo));
        row.Bytes.ShouldBe(stored.Bytes.Length);
        row.Bytes.ShouldBeLessThan(photo.Length);
        row.Format.ShouldBe("webp");
        row.Width.ShouldBe(4000);
        row.Height.ShouldBe(3000);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnIphoneHeicReachesStorageWithItsExifAndXmpZeroedAndItsSizeAndTurnKept(bool useIdat)
    {
        var heic = SyntheticImages.HeicWithMetadata(4032, 3024, rotation: 1, useIdat);

        var (stored, row) = await UploadAndReadAsync(heic, "IMG_0001.HEIC", "image/heic");

        AssertClean(stored.Bytes.Span);
        stored.Bytes.Length.ShouldBe(heic.Length);
        stored.Bytes.Span.IndexOf(SyntheticImages.HeicImageData).ShouldBeGreaterThan(0);
        ImageSniffer.Inspect(stored.Bytes.Span).ShouldBe(ImageSniffer.Inspect(heic));
        row.Bytes.ShouldBe(heic.Length);
        row.Format.ShouldBe("heic");
        row.Width.ShouldBe(3024);
        row.Height.ShouldBe(4032);
    }

    [Fact]
    public async Task AHeicWhoseExifCannotBeLocatedIsRefusedWithTheTypeMessageAndNothingIsStored()
    {
        var refused = SyntheticImages.HeicWithLocations(
            SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1"), SyntheticImages.Infe(2, "Exif")),
            offsets => SyntheticImages.Iloc(
                1,
                4,
                4,
                0,
                new IlocItem(1, 0, 0, 0, [new IlocExtent(offsets.Mdat, SyntheticImages.HeicImageData.Length)]),
                new IlocItem(2, 2, 0, 0, [new IlocExtent(0, 4)])),
            null,
            [.. SyntheticImages.HeicImageData, 0x00, 0x00, 0x00, 0x00]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, refused, "IMG_0002.HEIC", "image/heic");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.type");
        OrderFixtures.FieldErrors(problem, "file").ShouldBe(["IMG_0002.HEIC isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    private static void AssertClean(ReadOnlySpan<byte> stored)
    {
        foreach (var text in MetadataTexts)
        {
            ContainsBytes(stored, Encoding.ASCII.GetBytes(text)).ShouldBeFalse(text);
        }
    }

    private static bool ContainsBytes(ReadOnlySpan<byte> file, ReadOnlySpan<byte> pattern) => file.IndexOf(pattern) >= 0;

    private async Task<(StoredTestImage Stored, OrderImage Row)> UploadAndReadAsync(byte[] file, string fileName, string contentType)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await CreateOrderAsync(factory, client, manager.AccessToken);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, file, fileName, contentType);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var upload = storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem();
        storage.TryGet(upload.PublicId[(upload.PublicId.LastIndexOf('/') + 1)..], out var stored).ShouldBeTrue();
        stored.Bytes.Length.ShouldBe(upload.Length);
        await using var context = database.CreateContext();
        var row = await context.Set<OrderImage>().AsNoTracking().SingleAsync(image => image.OrderId == id, TestContext.Current.CancellationToken);
        return (stored, row);
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
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
