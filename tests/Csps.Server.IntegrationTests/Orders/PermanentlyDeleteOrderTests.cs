using System.Net;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// D-22, T-13-61: a converted quote request lives exactly as long as its order. Permanently deleting the order removes the request with
/// its photo places, notes and history in the same save and queues its stored photos as OrderDeleted; a soft delete keeps the request
/// and its link, and an order with no request is deleted as before.
/// </summary>
public sealed class PermanentlyDeleteOrderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task APermanentDeleteTakesTheConvertedRequestWithItsPhotosNotesAndHistory()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Contacted, Received, PhotoNames: ["front.jpg", "back.jpg", "never.jpg"], StoredSlots: [0, 1]));
        var keptId = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.New, Received, PhotoNames: ["kept.jpg"], StoredSlots: [0]));
        using (var note = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = "Called, sending the mockup Friday." }))
        {
            note.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var order = await CreateFromAsync(rig, id);
        var orderId = order.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PermanentlyDeleteAsync(rig.Client, manager.AccessToken, orderId, order.GetProperty("number").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        (await context.Orders.IgnoreQueryFilters().CountAsync(row => row.Id == orderId, token)).ShouldBe(0);
        (await context.QuoteRequests.CountAsync(request => request.Id == id, token)).ShouldBe(0);
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestNotes.CountAsync(note => note.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == keptId, token)).ShouldBe(1);

        var queued = await context.Set<ImageDeletion>().AsNoTracking().ToListAsync(token);
        queued.Select(row => (row.PublicId, row.Reason)).ShouldBe(
            [(QuoteRequestStaffRig.PublicIdOf(id, 0), ImageDeletionReason.OrderDeleted), (QuoteRequestStaffRig.PublicIdOf(id, 1), ImageDeletionReason.OrderDeleted)],
            ignoreOrder: true);

        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(audit => audit.Action == "quote-request.deleted" && audit.TargetId == id.ToString("D"), token);
        (entry.ActorUserId, entry.Detail).ShouldBe(((Guid?)manager.UserId, "status=converted;photos=2"));
    }

    [Fact]
    public async Task ASoftDeleteKeepsTheRequestAndItsLinkAndARestoreShowsTheLinkAgain()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received, PhotoNames: ["front.jpg"], StoredSlots: [0]));
        var orderId = (await CreateFromAsync(rig, id)).GetProperty("id").GetGuid();

        using (var deleted = await OrderFixtures.DeleteAsync(rig.Client, manager.AccessToken, orderId))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var detail = await rig.ReadAsync(id);
        (detail.GetProperty("status").GetString(), detail.GetProperty("orderId").GetGuid()).ShouldBe(("converted", orderId));
        detail.GetProperty("photos").GetArrayLength().ShouldBe(1);

        using (var restored = await OrderFixtures.RestoreAsync(rig.Client, manager.AccessToken, orderId))
        {
            restored.StatusCode.ShouldBe(HttpStatusCode.NoContent, await restored.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var read = await rig.GetAsync(rig.Admin.AccessToken, $"{OrderFixtures.Route}/{orderId:D}");
        (await QuoteRequestStaffRig.BodyAsync(read, HttpStatusCode.OK)).GetProperty("quoteRequestId").GetGuid().ShouldBe(id);
        await using var context = database.CreateContext();
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnOrderWithNoRequestIsPermanentlyDeletedAsBeforeAndLeavesEveryRequest()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var keptId = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.New, Received, PhotoNames: ["kept.jpg"], StoredSlots: [0]));
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        var order = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        using var response = await OrderFixtures.PermanentlyDeleteAsync(rig.Client, manager.AccessToken, order.GetProperty("id").GetGuid(), order.GetProperty("number").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        (await context.QuoteRequests.CountAsync(request => request.Id == keptId, token)).ShouldBe(1);
        (await context.Set<ImageDeletion>().CountAsync(token)).ShouldBe(0);
        (await context.AuditLog.CountAsync(audit => audit.Action == "quote-request.deleted" && audit.TargetId == keptId.ToString("D"), token)).ShouldBe(0);
    }

    private static async Task<System.Text.Json.JsonElement> CreateFromAsync(QuoteRequestStaffRig rig, Guid quoteRequestId)
    {
        var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["quoteRequestId"] = quoteRequestId;
        using var response = await OrderFixtures.PostAsync(rig.Client, rig.Admin.AccessToken, body);
        return await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.Created);
    }
}
