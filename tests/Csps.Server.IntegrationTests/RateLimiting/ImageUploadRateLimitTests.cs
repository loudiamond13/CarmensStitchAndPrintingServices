using System.Net;
using Csps.Application.Security;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// IMG-02, T-09-27: the memory guard for the 256 MB app pool. One address may upload 30 times in 10 minutes, and the whole app
/// processes two uploads at a time (up to four wait, then 429). Only the upload endpoint is held to the cap.
/// </summary>
public sealed class ImageUploadRateLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string UploadsBusyText = "Too many uploads right now. Wait a minute, then try again.";
    private const int PerAddressLimit = 30;
    private const int ProcessedAtOnce = 2;
    private const int Waiting = 4;
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task TheThirtyFirstUploadFromOneAddressInTenMinutesGets429AndAnotherAddressIsUnaffected()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();
        var orderId = Guid.NewGuid();

        for (var attempt = 1; attempt <= PerAddressLimit; attempt++)
        {
            using var inside = await UploadAnonymouslyAsync(client, orderId, "203.0.113.10");
            inside.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, $"upload {attempt} is inside the limit");
        }

        using var rejected = await UploadAnonymouslyAsync(client, orderId, "203.0.113.10");
        using var other = await UploadAnonymouslyAsync(client, orderId, "203.0.113.11");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe(UploadsBusyText);
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 600);
        other.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheUploadLimitDoesNotTouchAnotherEndpoint()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();
        for (var attempt = 1; attempt <= PerAddressLimit + 1; attempt++)
        {
            using var upload = await UploadAnonymouslyAsync(client, Guid.NewGuid(), "203.0.113.20");
        }

        using var request = ApiRequests.Get("/health");
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, "203.0.113.20");
        using var health = await client.SendAsync(request, TestContext.Current.CancellationToken);

        health.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SevenUploadsTogetherRunTwoQueueFourAndRefuseOneUntilTheStorageIsReleased()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var orders = new List<Guid>();
        for (var count = 0; count < ProcessedAtOnce + Waiting + 1; count++)
        {
            orders.Add(await CreateOrderAsync(factory, client, manager.AccessToken));
        }

        storage.HoldUploadsStepwise();
        var uploads = orders.Select(id => Task.Run(() => UploadAsync(client, manager.AccessToken, id), TestContext.Current.CancellationToken)).ToList();

        var first = await Task.WhenAny(uploads).WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken);
        using var refused = await first;
        await WaitForAsync(() => storage.Uploads.Count == ProcessedAtOnce);
        await Task.Delay(TimeSpan.FromMilliseconds(500), TestContext.Current.CancellationToken);

        refused.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe(UploadsBusyText);
        refused.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBe(60);
        storage.Uploads.Count.ShouldBe(ProcessedAtOnce);
        uploads.Count(upload => upload.IsCompleted).ShouldBe(1);

        using var healthRequest = ApiRequests.Get("/health");
        using var health = await client.SendAsync(healthRequest, TestContext.Current.CancellationToken);
        health.StatusCode.ShouldBe(HttpStatusCode.OK);

        // One at a time: each finished upload frees a slot and the oldest waiting one takes it. They finish one by one on purpose,
        // because two uploads saving at the same moment can deadlock in the order photo read (recorded in the 09-14 summary).
        var queued = uploads.Where(upload => upload != first).ToList();
        for (var step = 1; step <= queued.Count; step++)
        {
            storage.ReleaseNext();
            await WaitForAsync(() => queued.Count(upload => upload.IsCompleted) == step);
            await WaitForAsync(() => storage.Uploads.Count == Math.Min(ProcessedAtOnce + step, queued.Count));
        }

        var answers = await Task.WhenAll(queued).WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken);
        foreach (var answer in answers)
        {
            using (answer)
            {
                answer.StatusCode.ShouldBe(HttpStatusCode.OK);
            }
        }

        storage.Uploads.Count.ShouldBe(ProcessedAtOnce + Waiting);
    }

    [Fact]
    public async Task AnAnonymousUploadIsRefusedWith401EvenWhenAllSlotsAndQueuePlacesAreTaken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var orders = new List<Guid>();
        for (var count = 0; count < ProcessedAtOnce + Waiting; count++)
        {
            orders.Add(await CreateOrderAsync(factory, client, manager.AccessToken));
        }

        storage.HoldUploadsStepwise();
        var uploads = orders.Select(id => Task.Run(() => UploadAsync(client, manager.AccessToken, id), TestContext.Current.CancellationToken)).ToList();
        await WaitForAsync(() => storage.Uploads.Count == ProcessedAtOnce);
        await Task.Delay(TimeSpan.FromMilliseconds(500), TestContext.Current.CancellationToken);

        using var anonymous = await UploadAnonymouslyAsync(client, Guid.NewGuid(), "203.0.113.30");

        for (var step = 1; step <= uploads.Count; step++)
        {
            storage.ReleaseNext();
            await WaitForAsync(() => uploads.Count(upload => upload.IsCompleted) == step);
        }

        foreach (var answer in await Task.WhenAll(uploads).WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken))
        {
            answer.Dispose();
        }

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task WaitForAsync(Func<bool> condition)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        while (!condition())
        {
            await Task.Delay(TimeSpan.FromMilliseconds(25), timeout.Token);
        }
    }

    private static async Task<Guid> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return created.GetProperty("id").GetGuid();
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("rate-boundary", [MultipartPart.Upload("file", Photo)]);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> UploadAnonymouslyAsync(HttpClient client, Guid orderId, string address)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images");
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        request.Content = MultipartBodies.Content("rate-boundary", [MultipartPart.Upload("file", Photo)]);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
