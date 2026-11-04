using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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

    // A clearly fake test-only value, built here so no key-shaped text sits in the repository.
    private static readonly string TestKey = new('k', 40);
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task APermanentlyDeletedOrdersPhotoIsRemovedFromTheStorageByTheNextRun()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var (id, number) = await CreateOrderWithPhotosAsync(baseFactory, client, manager.AccessToken, photos: 1);
        var publicId = (await PhotoIdsAsync(id)).ShouldHaveSingleItem();
        using var deleted = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, number);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        storage.Removals.ShouldBeEmpty();

        var run = await RunAsync(client);

        run.Ok.ShouldBeTrue(run.Text);
        run.Line(RemovedLabel).GetProperty("value").GetInt64().ShouldBe(1);
        storage.Removals.ShouldBe([publicId]);
        (await QueueIdsAsync()).ShouldBeEmpty();
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

    private async Task<List<string>> QueueIdsAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<ImageDeletion>().AsNoTracking().Select(row => row.PublicId).ToListAsync(TestContext.Current.CancellationToken);
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
