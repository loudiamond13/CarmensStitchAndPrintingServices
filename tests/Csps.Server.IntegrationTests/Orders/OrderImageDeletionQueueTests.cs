using System.Net;
using System.Text.Json;
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
/// JOB-02, D-20, IMG-01, ORD-04: a photo delete and a Manager's permanent delete queue the photo files for removal in the same save, a
/// soft delete and a restore queue nothing, and nothing reaches the storage inside the request.
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

    [Fact]
    public async Task AnUploadFinishingAfterTheOrderWasCancelledAnswers422LeavesNoPhotoAndQueuesOneUploadUndoneRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        storage.HoldUploads();
        var upload = Task.Run(() => UploadAsync(client, manager.AccessToken, id), TestContext.Current.CancellationToken);
        await WaitForAsync(() => storage.Uploads.Count == 1);
        using var cancelled = await OrderFixtures.ChangeStatusAsync(client, manager.AccessToken, id, OrderFixtures.StatusBody("cancelled"));
        cancelled.StatusCode.ShouldBe(HttpStatusCode.OK, await cancelled.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        storage.Release();
        using var answer = await upload.WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken);

        answer.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await answer.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await PhotoIdsAsync(id)).ShouldBeEmpty();
        var uploadedId = storage.Uploads.ShouldHaveSingleItem().PublicId;
        var row = (await QueueRowsAsync([uploadedId])).ShouldHaveSingleItem();
        row.Reason.ShouldBe(ImageDeletionReason.UploadUndone);
        row.Attempts.ShouldBe(0);
        storage.Removals.ShouldBeEmpty();
    }

    [Fact]
    public async Task DeletingTheCoverOfThreePhotosAnswers200RenumbersTheRestQueuesOneRowAndCallsTheStorageForNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var (id, number) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 3);
        var before = await PhotoRowsAsync(id);
        var cover = before[0];

        using var response = await DeleteImageAsync(client, manager.AccessToken, id, cover.Id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var answered = document.RootElement.GetProperty("images").EnumerateArray().ToList();
        answered.Select(image => image.GetProperty("id").GetGuid()).ShouldBe([before[1].Id, before[2].Id]);
        answered.Select(image => image.GetProperty("position").GetInt32()).ShouldBe([0, 1]);
        (await PhotoRowsAsync(id)).Select(row => (row.Id, row.Position)).ShouldBe([(before[1].Id, 0), (before[2].Id, 1)]);
        var row = (await QueueRowsAsync([cover.PublicId])).ShouldHaveSingleItem();
        row.Reason.ShouldBe(ImageDeletionReason.PhotoDeleted);
        row.Attempts.ShouldBe(0);
        row.LeaseUntilUtc.ShouldBeNull();
        (await QueueRowsAsync([before[1].PublicId, before[2].PublicId])).ShouldBeEmpty();
        (await ImageDeletedAuditAsync(id)).ShouldHaveSingleItem().ShouldBe($"number={number};position=1");
        storage.Removals.ShouldBeEmpty();
    }

    [Fact]
    public async Task DeletingTheSamePhotoTwiceAnswers200Then404AndQueuesOneRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, admin.AccessToken, photos: 3);
        var target = (await PhotoRowsAsync(id))[1];

        using var first = await DeleteImageAsync(client, admin.AccessToken, id, target.Id);
        using var second = await DeleteImageAsync(client, admin.AccessToken, id, target.Id);

        first.StatusCode.ShouldBe(HttpStatusCode.OK, await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.image-not-found");
        (await QueueRowsAsync([target.PublicId])).ShouldHaveSingleItem();
        (await ImageDeletedAuditAsync(id)).Count.ShouldBe(1);
        (await PhotoRowsAsync(id)).Count.ShouldBe(2);
    }

    [Fact]
    public async Task APhotoOfAnotherOrderAnswers404AndQueuesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 1);
        var (otherId, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 2);
        var foreign = (await PhotoRowsAsync(otherId))[0];

        using var response = await DeleteImageAsync(client, manager.AccessToken, id, foreign.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await QueueRowsAsync([foreign.PublicId])).ShouldBeEmpty();
        (await PhotoRowsAsync(otherId)).Count.ShouldBe(2);
        (await PhotoRowsAsync(id)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ADeleteOnACompletedOrderAnswers422LockedKeepsThePhotoAndQueuesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        using (var upload = await UploadAsync(client, manager.AccessToken, id))
        {
            upload.StatusCode.ShouldBe(HttpStatusCode.OK, await upload.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        _ = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");
        var photo = (await PhotoRowsAsync(id)).ShouldHaveSingleItem();

        using var response = await DeleteImageAsync(client, manager.AccessToken, id, photo.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
        (await QueueRowsAsync([photo.PublicId])).ShouldBeEmpty();
        (await PhotoRowsAsync(id)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ADeleteWithoutATokenAnswers401AndQueuesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var (id, _) = await CreateOrderWithPhotosAsync(factory, client, manager.AccessToken, photos: 1);
        var photo = (await PhotoRowsAsync(id)).ShouldHaveSingleItem();

        using var response = await DeleteImageAsync(client, accessToken: null, id, photo.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await QueueRowsAsync([photo.PublicId])).ShouldBeEmpty();
        (await PhotoRowsAsync(id)).Count.ShouldBe(1);
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

    private static async Task<HttpResponseMessage> DeleteImageAsync(HttpClient client, string? accessToken, Guid orderId, Guid imageId)
    {
        using var request = ApiRequests.Create(HttpMethod.Delete, $"/api/v1/orders/{orderId:D}/images/{imageId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<List<(Guid Id, string PublicId, int Position)>> PhotoRowsAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().IgnoreQueryFilters().AsNoTracking()
            .Where(image => image.OrderId == orderId)
            .OrderBy(image => image.Position)
            .Select(image => new { image.Id, image.PublicId, image.Position })
            .ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.Select(row => (row.Id, row.PublicId, row.Position))];
    }

    private async Task<List<string?>> ImageDeletedAuditAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == orderId.ToString("D") && entry.Action == "order-image.deleted")
            .Select(entry => entry.Detail)
            .ToListAsync(TestContext.Current.CancellationToken);
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
