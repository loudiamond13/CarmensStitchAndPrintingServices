using System.Net;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Images;
using Csps.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>
/// INQ-05, D-14, D-15, SEC-07, SEC-08: staff move a request freely between the five hand-set statuses with its row version; each move is
/// one history row and one audit entry, Converted is never set or left by hand, and a stale version is a 409. Spam removes the photos
/// for good through the removal queue (D-04).
/// </summary>
public sealed class QuoteRequestStatusTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnAdminMovesNewToContactedAndTheMoveIsRecordedWithTheTokensStampsOnly()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var before = await NewCountAsync(rig);
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        var startedAt = TimeProvider.System.GetUtcNow().AddMinutes(-1);

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new
        {
            status = "contacted",
            version,
            updatedById = Guid.NewGuid(),
            updatedAtUtc = "2020-01-01T00:00:00Z",
            changedById = Guid.NewGuid(),
        });
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);

        // The answer is slim: the page reads the request again for the history.
        body.EnumerateObject().Select(member => member.Name).ShouldBe(["id", "status", "statusChangedAtUtc", "version"]);
        body.GetProperty("id").GetGuid().ShouldBe(id);
        body.GetProperty("status").GetString().ShouldBe("contacted");
        var newVersion = body.GetProperty("version").GetString();
        newVersion.ShouldNotBe(version);
        var detail = await rig.ReadAsync(id);
        detail.GetProperty("version").GetString().ShouldBe(newVersion);
        body.GetProperty("statusChangedAtUtc").GetDateTimeOffset().ShouldBe(detail.GetProperty("statusChangedAtUtc").GetDateTimeOffset());
        var history = detail.GetProperty("history").EnumerateArray().ToList();
        history.Count.ShouldBe(2);
        history[0].GetProperty("from").GetString().ShouldBe("new");
        history[0].GetProperty("to").GetString().ShouldBe("contacted");
        history[0].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        history[1].GetProperty("to").GetString().ShouldBe("new");
        detail.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        (await NewCountAsync(rig)).ShouldBe(before - 1);

        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var stored = await context.QuoteRequests.AsNoTracking().SingleAsync(request => request.Id == id, token);
        stored.UpdatedById.ShouldBe(rig.Admin.UserId);
        stored.UpdatedAtUtc.ShouldNotBeNull().ShouldBeGreaterThan(startedAt);
        stored.StatusChangedAtUtc.ShouldBeGreaterThan(startedAt);
        var row = await context.QuoteRequestStatusChanges.AsNoTracking().SingleAsync(change => change.QuoteRequestId == id, token);
        (row.FromStatus, row.ToStatus, row.ChangedById).ShouldBe((QuoteRequestStatus.New, QuoteRequestStatus.Contacted, (Guid?)rig.Admin.UserId));
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(audit => audit.Action == "quote-request.status-changed" && audit.TargetId == id.ToString("D"), token);
        (entry.TargetType, entry.ActorUserId, entry.Detail).ShouldBe(("QuoteRequest", (Guid?)rig.Admin.UserId, "status=new>contacted"));
    }

    [Fact]
    public async Task AManagerMovesARequestBackOutOfClosed()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Closed, Received));
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(manager.AccessToken, id, new { status = "new", version });
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);

        body.GetProperty("status").GetString().ShouldBe("new");
        (await rig.ReadAsync(id)).GetProperty("history")[0].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task TheStoredRetryAnswerHoldsNoVisitorDetailsOrPhotoAddresses()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed(
            "Juan Dela Cruz",
            QuoteRequestStatus.New,
            Received,
            Team: "Brgy. San Roque Ballers",
            Email: "juan@example.test",
            Message: "Twelve jerseys, numbers 1 to 12.",
            PhotoNames: ["front.jpg"],
            StoredSlots: [0]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "contacted", version });
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        // The idempotency gate keeps the 200 answer for 24 hours, where the purge and the delete cannot reach it.
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var stored = await context.IdempotencyRecords.AsNoTracking()
            .Where(record => record.ResponseBody != null && record.ResponseBody.Contains(id.ToString("D")))
            .Select(record => record.ResponseBody!)
            .SingleAsync(token);
        foreach (var personal in new[] { "Juan Dela Cruz", "San Roque", "juan@example.test", "0917", "Twelve jerseys", "front.jpg", "fullSize", "thumb" })
        {
            stored.ShouldNotContain(personal, Case.Insensitive);
        }
    }

    [Fact]
    public async Task AStaleVersionIs409AndChangesNothing()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        using (var first = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "quoted", version }))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var second = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "closed", version });
        var problem = await QuoteRequestStaffRig.BodyAsync(second, HttpStatusCode.Conflict);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.conflict");
        (await rig.ReadAsync(id)).GetProperty("status").GetString().ShouldBe("quoted");
    }

    [Fact]
    public async Task ConvertedIsNeverAcceptedAsATarget()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Quoted, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "converted", version });
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.validation");
        problem.GetProperty("errors").GetProperty("status")[0].GetString().ShouldBe("Choose a status.");
        (await rig.ReadAsync(id)).GetProperty("status").GetString().ShouldBe("quoted");
    }

    [Fact]
    public async Task AConvertedRequestCannotChangeStatusByHand()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Converted, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "closed", version });
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.converted-locked");
        (await rig.ReadAsync(id)).GetProperty("status").GetString().ShouldBe("converted");
    }

    [Fact]
    public async Task AnAnonymousCallerGets401AndAnUnknownRequestIs404()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var anonymous = await rig.PostStatusAsync(null, id, new { status = "contacted", version });
        using var unknown = await rig.PostStatusAsync(rig.Admin.AccessToken, Guid.NewGuid(), new { status = "contacted", version });

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await QuoteRequestStaffRig.BodyAsync(unknown, HttpStatusCode.NotFound)).GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
        (await rig.ReadAsync(id)).GetProperty("status").GetString().ShouldBe("new");
    }

    [Fact]
    public async Task MovingToSpamQueuesEachStoredPhotoRemovesThePlacesAndSetsTheRemovalTime()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Spam Sid", QuoteRequestStatus.New, Received, PhotoNames: ["a.jpg", "b.jpg", "c.heic"], StoredSlots: [0, 1]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "spam", version });
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);

        body.GetProperty("status").GetString().ShouldBe("spam");
        var spamDetail = await rig.ReadAsync(id);
        spamDetail.GetProperty("photos").GetArrayLength().ShouldBe(0);
        spamDetail.GetProperty("missingPhotos").GetArrayLength().ShouldBe(0);
        spamDetail.GetProperty("photoCount").GetInt32().ShouldBe(0);
        var removedAt = spamDetail.GetProperty("photosRemovedAtUtc").GetDateTimeOffset();
        var token = TestContext.Current.CancellationToken;
        await using (var context = database.CreateContext())
        {
            (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == id, token)).ShouldBe(0);
            var queued = await context.Set<ImageDeletion>().AsNoTracking().ToListAsync(token);
            queued.Select(row => row.PublicId).ShouldBe([QuoteRequestStaffRig.PublicIdOf(id, 0), QuoteRequestStaffRig.PublicIdOf(id, 1)], ignoreOrder: true);
            queued.ShouldAllBe(row => row.Reason == ImageDeletionReason.QuoteSpam);
        }

        using var list = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}?status=spam");
        var row = (await QuoteRequestStaffRig.BodyAsync(list, HttpStatusCode.OK)).GetProperty("items")[0];
        row.GetProperty("photosRemoved").GetBoolean().ShouldBeTrue();

        // Moving back out of Spam keeps the photos gone and the removal time.
        var spamVersion = body.GetProperty("version").GetString();
        using var back = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "new", version = spamVersion });
        var after = await QuoteRequestStaffRig.BodyAsync(back, HttpStatusCode.OK);
        after.GetProperty("status").GetString().ShouldBe("new");
        var backDetail = await rig.ReadAsync(id);
        backDetail.GetProperty("photos").GetArrayLength().ShouldBe(0);
        backDetail.GetProperty("photosRemovedAtUtc").GetDateTimeOffset().ShouldBe(removedAt);
        using var openList = await rig.GetAsync(rig.Admin.AccessToken, QuoteRequestStaffRig.Route);
        (await QuoteRequestStaffRig.BodyAsync(openList, HttpStatusCode.OK)).GetProperty("items")[0].GetProperty("photosRemoved").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task SpamWithNoPhotosQueuesNothingAndSetsNoRemovalTime()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Spam Sid", QuoteRequestStatus.Contacted, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "spam", version });
        (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK)).GetProperty("status").GetString().ShouldBe("spam");

        (await rig.ReadAsync(id)).GetProperty("photosRemovedAtUtc").ValueKind.ShouldBe(System.Text.Json.JsonValueKind.Null);
        await using var context = database.CreateContext();
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AFailureBeforeTheSaveLeavesThePhotosTheStatusAndTheQueueUnchanged()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database, factory => factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                var original = services.Single(descriptor => descriptor.ServiceType == typeof(IAuditTrail));
                var implementation = original.ImplementationType.ShouldNotBeNull();
                services.Remove(original);
                services.AddScoped(implementation);
                services.AddScoped<IAuditTrail>(provider => new FailingStatusAudit((IAuditTrail)provider.GetRequiredService(implementation)));
            })));
        var id = await rig.SeedAsync(new QuoteSeed("Spam Sid", QuoteRequestStatus.New, Received, PhotoNames: ["a.jpg", "b.jpg"], StoredSlots: [0, 1]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "spam", version });

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var stored = await context.QuoteRequests.AsNoTracking().SingleAsync(request => request.Id == id, token);
        stored.Status.ShouldBe(QuoteRequestStatus.New);
        stored.PhotosRemovedAtUtc.ShouldBeNull();
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == id && photo.PublicId != null, token)).ShouldBe(2);
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.Set<ImageDeletion>().CountAsync(token)).ShouldBe(0);
    }

    private static async Task<int> NewCountAsync(QuoteRequestStaffRig rig)
    {
        using var response = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}/new-count");
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);
        return body.GetProperty("count").GetInt32();
    }

    // Fails the status entry after the photos were queued and before the save, to prove they share one transaction.
    private sealed class FailingStatusAudit(IAuditTrail inner) : IAuditTrail
    {
        public void Record(string action, string? targetType, string? targetId, string? detail)
        {
            if (action == "quote-request.status-changed")
            {
                throw new InvalidOperationException("The test audit trail failed.");
            }

            inner.Record(action, targetType, targetId, detail);
        }

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            inner.RecordIndependentlyAsync(action, targetType, targetId, detail, cancellationToken);
    }
}
