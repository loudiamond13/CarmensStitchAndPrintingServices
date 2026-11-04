using System.Net;
using Csps.Application.Ports;
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

/// <summary>
/// JOB-02, D-20, IMG-01: a Manager's permanent delete queues every photo file for removal in the same save, a soft delete and a restore
/// queue nothing, and nothing reaches the storage inside the request.
/// </summary>
public sealed class OrderImageDeletionQueueTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task APermanentDeleteOfAnOrderWithThreePhotosQueuesThreeRowsAndCallsTheStorageForNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var (id, number) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 3);
        var publicIds = await PhotoIdsAsync(id);
        publicIds.Count.ShouldBe(3);

        using var response = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, number);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var rows = await QueueRowsAsync(publicIds);
        rows.Count.ShouldBe(3);
        rows.Select(row => row.PublicId).Order(StringComparer.Ordinal).ShouldBe(publicIds.Order(StringComparer.Ordinal));
        rows.ShouldAllBe(row => row.Reason == ImageDeletionReason.OrderDeleted && row.Attempts == 0 && row.DeliveryType == "private");
        rows.ShouldAllBe(row => row.LeaseUntilUtc == null && row.LeaseHolder == null && row.LastFailureCode == null);
        storage.Removals.ShouldBeEmpty();
        (await PhotoIdsAsync(id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task APermanentDeleteOfASoftDeletedOrderAlsoQueuesItsPhotos()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var (id, number) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 2);
        var publicIds = await PhotoIdsAsync(id);
        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, number);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await QueueRowsAsync(publicIds)).Count.ShouldBe(2);
    }

    [Fact]
    public async Task ASoftDeleteQueuesNothingAndKeepsThePhotos()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 3);
        var publicIds = await PhotoIdsAsync(id);

        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await QueueRowsAsync(publicIds)).ShouldBeEmpty();
        storage.Removals.ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().IgnoreQueryFilters().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(3);
    }

    [Fact]
    public async Task ARestoreQueuesNothingAndBringsEveryPhotoBack()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 3);
        var publicIds = await PhotoIdsAsync(id);
        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await QueueRowsAsync(publicIds)).ShouldBeEmpty();
        (await PhotoIdsAsync(id)).Order(StringComparer.Ordinal).ShouldBe(publicIds.Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task APermanentDeleteWithAWrongConfirmQueuesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 2);
        var publicIds = await PhotoIdsAsync(id);

        using var response = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, "not-the-number");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await QueueRowsAsync(publicIds)).ShouldBeEmpty();
        (await PhotoIdsAsync(id)).Count.ShouldBe(2);
    }

    private static async Task<(Guid Id, string Number)> CreateOrderWithPhotosAsync(CspsApiFactory factory, HttpClient client, string accessToken, int photos)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        for (var count = 0; count < photos; count++)
        {
            using var upload = await UploadAsync(client, accessToken, id);
            upload.StatusCode.ShouldBe(HttpStatusCode.OK, await upload.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        return (id, created.GetProperty("number").GetString()!);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("queue-boundary", [MultipartPart.Upload("file", Photo)]);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<List<string>> PhotoIdsAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        return await context.Set<OrderImage>().IgnoreQueryFilters().AsNoTracking()
            .Where(image => image.OrderId == orderId)
            .Select(image => image.PublicId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<ImageDeletion>> QueueRowsAsync(List<string> publicIds)
    {
        await using var context = database.CreateContext();
        return await context.Set<ImageDeletion>().AsNoTracking()
            .Where(row => publicIds.Contains(row.PublicId))
            .ToListAsync(TestContext.Current.CancellationToken);
    }
}
