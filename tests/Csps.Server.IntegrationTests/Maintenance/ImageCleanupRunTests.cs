using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Logging;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace Csps.Server.IntegrationTests.Maintenance;

/// <summary>
/// JOB-02, D-05, D-22, D-23: a maintenance run removes the queued photo files from the storage, retries a failing removal and turns red
/// when it keeps failing, and sweeps stray files without ever touching a photo that an order still has.
/// </summary>
public sealed class ImageCleanupRunTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string KeyHeader = "X-Maintenance-Key";
    private const string KeySetting = "Maintenance:Key";
    private const string RunPath = "/api/v1/maintenance/run";
    private const string RemovedLabel = "Photos removed from storage";
    private const string StrayLabel = "Stray files removed (older than 2 days)";
    private const string DroppedLabel = "Queued removals dropped (photo still in use)";

    // A clearly fake test-only value, built here so no key-shaped text sits in the repository.
    private static readonly string TestKey = new('k', 40);
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task APermanentlyDeletedOrdersPhotoIsRemovedFromTheStorageByTheNextRun()
    {
        await using var scene = await StartDeletedPhotoSceneAsync();
        scene.Storage.Removals.ShouldBeEmpty();

        var run = await RunAsync(scene.Client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(1);
        scene.Storage.Removals.ShouldBe([scene.PublicId]);
        scene.Storage.TryGet(scene.LastSegment, out _).ShouldBeFalse();
        (await QueueIdsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ThreeTransientAnswersTurnTheRunRedKeepTheRowAndTheNextRunRemovesTheFile()
    {
        await using var scene = await StartDeletedPhotoSceneAsync();
        scene.Storage.FailNextRemovals(3);

        var failed = await RunAsync(scene.Client);

        failed.Ok.ShouldBeFalse(failed.Text);
        var failing = failed.Line("Photo removals still failing");
        failing.GetProperty("value").GetInt64().ShouldBe(1);
        failing.GetProperty("failed").GetBoolean().ShouldBeTrue();
        scene.Storage.Removals.Count.ShouldBe(3);
        scene.Storage.TryGet(scene.LastSegment, out _).ShouldBeTrue();
        var row = (await QueueRowsAsync()).ShouldHaveSingleItem();
        row.Attempts.ShouldBe(1);
        row.LastFailureCode.ShouldBe("transient");
        row.LastFailedAtUtc.ShouldNotBeNull();
        row.LeaseHolder.ShouldBeNull();

        var next = await RunAsync(scene.Client);

        next.Ok.ShouldBeTrue(next.Text);
        next.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(1);
        scene.Storage.TryGet(scene.LastSegment, out _).ShouldBeFalse();
        (await QueueRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFailedRemovalIsLoggedByRowIdAndCodeAndNeverByThePublicId()
    {
        await using var scene = await StartDeletedPhotoSceneAsync();
        scene.Storage.FailNextRemovals(1, new ImageRemovalOutcome(ImageRemovalStatus.Rejected, "refused"));

        var run = await RunAsync(scene.Client);
        await LogEvents.RequestCompletionAsync(scene.Sink, RunPath, TestContext.Current.CancellationToken);

        run.Ok.ShouldBeFalse(run.Text);
        var row = (await QueueRowsAsync()).ShouldHaveSingleItem();
        var lines = scene.Sink.Events.Select(Render).ToList();
        lines.ShouldContain(line => line.Contains("refused", StringComparison.Ordinal) && line.Contains(row.Id.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal));
        lines.ShouldAllBe(line => !line.Contains(scene.PublicId, StringComparison.Ordinal) && !line.Contains(scene.LastSegment, StringComparison.Ordinal));
        run.Text.ShouldNotContain(scene.LastSegment);
    }

    [Fact]
    public async Task AStrayFileOlderThanTwoDaysIsQueuedAndRemovedInOneRunWhileAYoungOneStays()
    {
        await using var scene = await StartSceneAsync();
        var folder = $"csps-test/orders/{Guid.NewGuid():D}";
        var stray = $"{folder}/{Guid.NewGuid():N}";
        var young = $"{folder}/{Guid.NewGuid():N}";
        var now = TimeProvider.System.GetUtcNow();
        scene.Storage.Seed(stray, now - TimeSpan.FromDays(3));
        scene.Storage.Seed(young, now - TimeSpan.FromDays(1));

        var run = await RunAsync(scene.Client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(StrayLabel).GetProperty("value").GetInt64().ShouldBe(1);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(1);
        scene.Storage.Removals.ShouldBe([stray]);
        scene.Storage.TryGet(stray[(stray.LastIndexOf('/') + 1)..], out _).ShouldBeFalse();
        scene.Storage.TryGet(young[(young.LastIndexOf('/') + 1)..], out _).ShouldBeTrue();
        (await QueueRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task APhotoOfASoftDeletedOrderOlderThanTwoDaysIsStillInTheStorageAfterTheRun()
    {
        await using var scene = await StartSceneAsync();
        var (liveId, _) = await CreateOrderWithPhotosAsync(scene.Calendar, scene.Client, scene.AccessToken, photos: 1);
        var (deletedId, _) = await CreateOrderWithPhotosAsync(scene.Calendar, scene.Client, scene.AccessToken, photos: 1);
        using var deleted = await OrderFixtures.DeleteAsync(scene.Client, scene.AccessToken, deletedId);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var photos = new List<string>([.. await PhotoIdsAsync(liveId), .. await PhotoIdsAsync(deletedId)]);
        photos.Count.ShouldBe(2);
        var old = TimeProvider.System.GetUtcNow() - TimeSpan.FromDays(30);
        photos.ForEach(photo => scene.Storage.Seed(photo, old));

        var run = await RunAsync(scene.Client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(StrayLabel).GetProperty("value").GetInt64().ShouldBe(0);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(0);
        scene.Storage.Removals.ShouldBeEmpty();
        photos.ShouldAllBe(photo => scene.Holds(photo));
        (await QueueRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUploadUndoneRowThatNamesALivePhotoOrASoftDeletedOnesIsDroppedAndTheFilesStay()
    {
        await using var scene = await StartSceneAsync();
        var (liveId, _) = await CreateOrderWithPhotosAsync(scene.Calendar, scene.Client, scene.AccessToken, photos: 1);
        var (deletedId, _) = await CreateOrderWithPhotosAsync(scene.Calendar, scene.Client, scene.AccessToken, photos: 1);
        using var deleted = await OrderFixtures.DeleteAsync(scene.Client, scene.AccessToken, deletedId);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var photos = new List<string>([.. await PhotoIdsAsync(liveId), .. await PhotoIdsAsync(deletedId)]);
        await QueueAsync(photos, ImageDeletionReason.UploadUndone);

        var run = await RunAsync(scene.Client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(0);
        run.Line(DroppedLabel).GetProperty("value").GetInt64().ShouldBe(2);
        scene.Storage.Removals.ShouldBeEmpty();
        photos.ShouldAllBe(photo => scene.Holds(photo));
        (await QueueRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheSweepAndAnEarlierDeleteMayQueueTheSameFileAndTheSecondRemovalIsHarmless()
    {
        await using var scene = await StartDeletedPhotoSceneAsync();
        scene.Storage.Seed(scene.PublicId, TimeProvider.System.GetUtcNow() - TimeSpan.FromDays(30));
        await QueueAsync([scene.PublicId], ImageDeletionReason.Stray);

        var run = await RunAsync(scene.Client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(2);
        scene.Storage.Removals.Count.ShouldBe(2);
        scene.Storage.TryGet(scene.LastSegment, out _).ShouldBeFalse();
        (await QueueRowsAsync()).ShouldBeEmpty();
    }

    private async Task QueueAsync(IEnumerable<string> publicIds, ImageDeletionReason reason)
    {
        await using var context = database.CreateContext();
        foreach (var publicId in publicIds)
        {
            context.Set<ImageDeletion>().Add(ImageDeletion.Queue(publicId, "private", reason, TimeProvider.System.GetUtcNow()));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Scene> StartSceneAsync()
    {
        await database.ResetAsync();
        var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        return new Scene(baseFactory, factory, client, factory.Services.GetRequiredService<TestingImageStorage>(), manager.AccessToken);
    }

    // A Manager's order with one photo that is then deleted for good, so the photo's file waits in the queue.
    private async Task<Scene> StartDeletedPhotoSceneAsync()
    {
        var scene = await StartSceneAsync();
        var (id, number) = await CreateOrderWithPhotosAsync(scene.Calendar, scene.Client, scene.AccessToken, photos: 1);
        scene.PublicId = (await PhotoIdsAsync(id)).ShouldHaveSingleItem();
        using var deleted = await OrderFixtures.PermanentlyDeleteAsync(scene.Client, scene.AccessToken, id, number);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        return scene;
    }

    // One event exactly as the log file writes it, with its properties.
    private static string Render(LogEvent logEvent)
    {
        using var writer = new StringWriter(CultureInfo.InvariantCulture);
        new CompactJsonFormatter().Format(logEvent, writer);
        return writer.ToString();
    }

    private sealed class Scene(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, HttpClient client, TestingImageStorage storage, string accessToken) : IAsyncDisposable
    {
        public HttpClient Client => client;

        public TestingImageStorage Storage => storage;

        public string AccessToken => accessToken;

        public CspsApiFactory Calendar => baseFactory;

        public string PublicId { get; set; } = string.Empty;

        public string LastSegment => PublicId[(PublicId.LastIndexOf('/') + 1)..];

        public CollectingSink Sink => baseFactory.Sink;

        public bool Holds(string publicId) => storage.TryGet(publicId[(publicId.LastIndexOf('/') + 1)..], out _);

        public async ValueTask DisposeAsync()
        {
            client.Dispose();
            await factory.DisposeAsync();
            await baseFactory.DisposeAsync();
        }
    }

    private static async Task<RunAnswer> RunAsync(HttpClient client)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(RunPath, UriKind.Relative));
        request.Headers.Add(KeyHeader, TestKey);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        return new RunAnswer(text, JsonDocument.Parse(text).RootElement.Clone());
    }

    private static async Task<(Guid Id, string Number)> CreateOrderWithPhotosAsync(CspsApiFactory factory, HttpClient client, string accessToken, int photos)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        for (var count = 0; count < photos; count++)
        {
            using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{id:D}/images", accessToken);
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
            request.Content = MultipartBodies.Content("cleanup-boundary", [MultipartPart.Upload("file", Photo)]);
            using var upload = await client.SendAsync(request, TestContext.Current.CancellationToken);
            upload.StatusCode.ShouldBe(HttpStatusCode.OK, await upload.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        return (id, created.GetProperty("number").GetString()!);
    }

    private async Task<List<string>> PhotoIdsAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        return await context.Set<OrderImage>().IgnoreQueryFilters().AsNoTracking()
            .Where(image => image.OrderId == orderId)
            .Select(image => image.PublicId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<string>> QueueIdsAsync() => [.. (await QueueRowsAsync()).Select(row => row.PublicId)];

    private async Task<List<ImageDeletion>> QueueRowsAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<ImageDeletion>().AsNoTracking().OrderBy(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    private sealed record RunAnswer(string Text, JsonElement Root)
    {
        public bool Ok => Root.GetProperty("ok").GetBoolean();

        public bool More => Root.GetProperty("more").GetBoolean();

        public JsonElement Line(string label)
        {
            HasLine(label).ShouldBeTrue($"The run has no line '{label}'. Answer: {Text}");
            return Root.GetProperty("lines").EnumerateArray().Single(line => line.GetProperty("label").GetString() == label);
        }

        public bool HasLine(string label) =>
            Root.GetProperty("lines").EnumerateArray().Any(line => line.GetProperty("label").GetString() == label);
    }
}
