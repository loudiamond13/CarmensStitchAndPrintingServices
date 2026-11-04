using System.Net;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Infrastructure.Images;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>IMG-01, D-05, D-07: the Cloudinary adapter sends the right calls and reads the answers, all against a stub (no network).</summary>
public sealed class CloudinaryImageStorageTests
{
    private const string FakeSecret = "test-secret-not-real";
    private const string FakeKey = "000000000000000";
    private const string PublicId = "csps-dev/orders/11111111111111111111111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private const string AssetFolder = "csps-dev/orders/11111111111111111111111111111111";

    private static readonly byte[] FakePhoto = [0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02, 0x03, 0xFF, 0xD9];

    private const string UploadedJson = """
        {"public_id":"csps-dev/orders/11111111111111111111111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":1,"signature":"x","width":10,"height":10,"format":"jpg","resource_type":"image","type":"private","bytes":9,"created_at":"2026-11-03T12:00:00Z"}
        """;

    private static (CloudinaryImageStorage Storage, StubCloudinaryHandler Handler) Build()
    {
        var handler = new StubCloudinaryHandler();
        var settings = new CloudinarySettings { CloudName = "demo-cloud", ApiKey = FakeKey, ApiSecret = FakeSecret, RootFolder = "csps-dev" };
        var storage = new CloudinaryImageStorage(Options.Create(settings), new StubHttpClientFactory(handler), NullLogger<CloudinaryImageStorage>.Instance);
        return (storage, handler);
    }

    private static ImageUpload Upload() => new(PublicId, AssetFolder, FakePhoto, ImageKind.Jpeg);

    [Fact]
    public void TheStorageIsConfiguredAndUsesTheEnvironmentsRootFolder()
    {
        var (storage, _) = Build();

        storage.IsConfigured.ShouldBeTrue();
        storage.RootFolder.ShouldBe("csps-dev");
    }

    [Fact]
    public async Task AnUploadSendsOnePrivateSignedNonOverwritingRequestToTheImageUploadEndpoint()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, UploadedJson);

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.Succeeded.ShouldBeTrue();
        var request = handler.Requests.ShouldHaveSingleItem();
        request.Method.ShouldBe(HttpMethod.Post);
        request.Uri.AbsolutePath.ShouldBe("/v1_1/demo-cloud/image/upload");
        request.Fields["type"].ShouldBe("private");
        request.Fields["public_id"].ShouldBe(PublicId);
        request.Fields["asset_folder"].ShouldBe(AssetFolder);
        request.Fields["overwrite"].ShouldBe("false");
        request.Fields["use_filename"].ShouldBe("false");
        request.Fields["unique_filename"].ShouldBe("false");
        request.Fields["allowed_formats"].ShouldBe("jpg,png,webp,heic");
        request.Fields["api_key"].ShouldBe(FakeKey);
        request.Fields["signature"].ShouldNotBeNullOrWhiteSpace();
        request.Fields["file"].ShouldBe($"{FakePhoto.Length} bytes");
    }

    [Fact]
    public async Task AnUploadNeverSendsAFolderFieldOrAnEmptyFieldOrTheSecret()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, UploadedJson);

        await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        var request = handler.Requests.ShouldHaveSingleItem();
        request.Fields.ShouldNotContainKey("folder");
        request.Fields.Where(field => field.Key != "file" && field.Value.Length == 0).ShouldBeEmpty();
        request.Fields.Values.ShouldNotContain(FakeSecret);
        request.Uri.ToString().ShouldNotContain(FakeSecret);
    }

    [Fact]
    public async Task AnUploadAnswered400IsRefusedWithTheTypeCode()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.BadRequest, """{"error":{"message":"Invalid image file"}}""");

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.Succeeded.ShouldBeFalse();
        outcome.FailureCode.ShouldBe(ImageErrors.TypeCode);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadGateway)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData((HttpStatusCode)420)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    public async Task AServerBusyOrRateLimitAnswerIsTransient(HttpStatusCode status)
    {
        var (storage, handler) = Build();
        handler.Reply(status, """{"error":{"message":"Try later"}}""");

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.Succeeded.ShouldBeFalse();
        outcome.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }

    [Fact]
    public async Task AGatewayPageThatIsNotJsonIsTransient()
    {
        var (storage, handler) = Build();
        handler.ReplyText(HttpStatusCode.BadGateway, "<html>Bad gateway</html>");

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }

    [Fact]
    public async Task ATimeoutIsTransient()
    {
        var (storage, handler) = Build();
        handler.Fail(new TaskCanceledException("The request timed out."));

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }

    [Fact]
    public async Task ADroppedConnectionIsTransient()
    {
        var (storage, handler) = Build();
        handler.Fail(new HttpRequestException("Connection reset."));

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task AnAnswerThatRefusesTheKeysIsUnauthorized(HttpStatusCode status)
    {
        var (storage, handler) = Build();
        handler.Reply(status, """{"error":{"message":"Invalid api_key"}}""");

        var outcome = await storage.UploadAsync(Upload(), TestContext.Current.CancellationToken);

        outcome.Succeeded.ShouldBeFalse();
        outcome.FailureCode.ShouldBe(CloudinaryResults.UnauthorizedCode);
    }

    [Fact]
    public async Task ACallerWhoCancelsGetsTheCancellationNotAnOutcome()
    {
        var (storage, handler) = Build();
        handler.Fail(new OperationCanceledException());
        using var source = new CancellationTokenSource();
        await source.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(() => storage.UploadAsync(Upload(), source.Token));
    }
}
