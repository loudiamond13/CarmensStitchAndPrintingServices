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

    [Fact]
    public async Task ARemovalSendsDestroyWithThePublicIdThePrivateTypeAndInvalidate()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """{"result":"ok"}""");

        var outcome = await storage.RemoveAsync(PublicId, TestContext.Current.CancellationToken);

        outcome.Status.ShouldBe(ImageRemovalStatus.Removed);
        var request = handler.Requests.ShouldHaveSingleItem();
        request.Method.ShouldBe(HttpMethod.Post);
        request.Uri.AbsolutePath.ShouldBe("/v1_1/demo-cloud/image/destroy");
        request.Fields["public_id"].ShouldBe(PublicId);
        request.Fields["type"].ShouldBe("private");
        request.Fields["invalidate"].ShouldBe("true");
        request.Fields["signature"].ShouldNotBeNullOrWhiteSpace();
        request.Fields.Values.ShouldNotContain(FakeSecret);
    }

    [Fact]
    public async Task ARemovalOfAFileThatIsAlreadyGoneIsNotFound()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """{"result":"not found"}""");

        var outcome = await storage.RemoveAsync(PublicId, TestContext.Current.CancellationToken);

        outcome.Status.ShouldBe(ImageRemovalStatus.NotFound);
    }

    [Theory]
    [InlineData((HttpStatusCode)420)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task ARemovalThatIsRateLimitedOrMetAServerErrorIsTransient(HttpStatusCode status)
    {
        var (storage, handler) = Build();
        handler.Reply(status, """{"error":{"message":"Try later"}}""");

        var outcome = await storage.RemoveAsync(PublicId, TestContext.Current.CancellationToken);

        outcome.Status.ShouldBe(ImageRemovalStatus.Transient);
        outcome.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task ARemovalWithRefusedKeysIsRejectedAsUnauthorized(HttpStatusCode status)
    {
        var (storage, handler) = Build();
        handler.Reply(status, """{"error":{"message":"Invalid api_key"}}""");

        var outcome = await storage.RemoveAsync(PublicId, TestContext.Current.CancellationToken);

        outcome.Status.ShouldBe(ImageRemovalStatus.Rejected);
        outcome.FailureCode.ShouldBe(CloudinaryResults.UnauthorizedCode);
    }

    [Fact]
    public async Task ARemovalThatTimesOutIsTransient()
    {
        var (storage, handler) = Build();
        handler.Fail(new TaskCanceledException("The request timed out."));

        var outcome = await storage.RemoveAsync(PublicId, TestContext.Current.CancellationToken);

        outcome.Status.ShouldBe(ImageRemovalStatus.Transient);
    }

    [Fact]
    public async Task AListingAsksForTheFolderPrefixWithTheTypeAndThePageSizeAndNoCursorOnTheFirstPage()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """{"resources":[]}""");

        await storage.ListAsync("csps-dev/orders/", null, TestContext.Current.CancellationToken);

        var request = handler.Requests.ShouldHaveSingleItem();
        request.Method.ShouldBe(HttpMethod.Get);
        request.Uri.AbsolutePath.ShouldBe("/v1_1/demo-cloud/resources/image");
        var query = System.Web.HttpUtility.ParseQueryString(request.Uri.Query);
        query["type"].ShouldBe("private");
        query["prefix"].ShouldBe("csps-dev/orders/");
        query["max_results"].ShouldBe("500");
        query["next_cursor"].ShouldBeNull();
        request.Uri.ToString().ShouldNotContain(FakeSecret);
    }

    [Fact]
    public async Task AListingPassesTheCursorAndReturnsTheFilesWithTheirCreatedTimesAndTheNextCursor()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """
            {"resources":[
              {"public_id":"csps-dev/orders/o1/a1","created_at":"2026-11-01T10:00:00Z","type":"private"},
              {"public_id":"csps-dev/orders/o1/a2","created_at":"2026-11-02T11:30:00Z","type":"private"}],
             "next_cursor":"cursor-two"}
            """);

        var page = await storage.ListAsync("csps-dev/orders/", "cursor-one", TestContext.Current.CancellationToken);

        System.Web.HttpUtility.ParseQueryString(handler.Requests.ShouldHaveSingleItem().Uri.Query)["next_cursor"].ShouldBe("cursor-one");
        page.NextCursor.ShouldBe("cursor-two");
        page.Entries.Select(entry => entry.PublicId).ShouldBe(["csps-dev/orders/o1/a1", "csps-dev/orders/o1/a2"]);
        page.Entries[1].CreatedAtUtc.ShouldBe(new DateTimeOffset(2026, 11, 2, 11, 30, 0, TimeSpan.Zero));
    }

    [Fact]
    public async Task TheLastPageHasNoNextCursor()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """{"resources":[{"public_id":"csps-dev/orders/o1/a1","created_at":"2026-11-01T10:00:00Z"}]}""");

        var page = await storage.ListAsync("csps-dev/orders/", null, TestContext.Current.CancellationToken);

        page.NextCursor.ShouldBeNull();
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "unauthorized")]
    [InlineData(HttpStatusCode.TooManyRequests, "transient")]
    [InlineData(HttpStatusCode.BadGateway, "transient")]
    public async Task AListingThatFailsThrowsWithTheShortCode(HttpStatusCode status, string code)
    {
        var (storage, handler) = Build();
        handler.Reply(status, """{"error":{"message":"No"}}""");

        var failure = await Should.ThrowAsync<ImageStorageException>(() => storage.ListAsync("csps-dev/orders/", null, TestContext.Current.CancellationToken));

        failure.FailureCode.ShouldBe(code);
        failure.Message.ShouldNotContain(FakeSecret);
    }

    [Fact]
    public async Task TheUsageReportIsReadWithStorageCreditsAndThePlansImageLimit()
    {
        var (storage, handler) = Build();
        handler.Reply(HttpStatusCode.OK, """
            {"plan":"Free","credits":{"usage":5.2,"limit":25,"used_percent":20.8},
             "storage":{"usage":1610612736,"credits_usage":1.5},
             "media_limits":{"image_max_size_bytes":10485760,"image_max_px":100000000}}
            """);

        var usage = await storage.GetUsageAsync(TestContext.Current.CancellationToken);

        var request = handler.Requests.ShouldHaveSingleItem();
        request.Method.ShouldBe(HttpMethod.Get);
        request.Uri.AbsolutePath.ShouldBe("/v1_1/demo-cloud/usage");
        usage.StorageBytes.ShouldBe(1_610_612_736);
        usage.CreditsUsed.ShouldBe(5.2, 0.0001);
        usage.CreditsLimit.ShouldBe(25);
        usage.CreditsPercent.ShouldBe(20.8, 0.0001);
        usage.ImageMaxBytes.ShouldBe(10_485_760);
    }

    [Fact]
    public async Task AUsageReportThatFailsThrowsWithTheShortCode()
    {
        var (storage, handler) = Build();
        handler.Fail(new HttpRequestException("Connection reset."));

        var failure = await Should.ThrowAsync<ImageStorageException>(() => storage.GetUsageAsync(TestContext.Current.CancellationToken));

        failure.FailureCode.ShouldBe(CloudinaryResults.TransientCode);
    }
}
