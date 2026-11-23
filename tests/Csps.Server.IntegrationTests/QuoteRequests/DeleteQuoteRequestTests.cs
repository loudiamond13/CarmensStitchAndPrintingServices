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
/// D-16, SEC-07, CWE-532, CWE-862: a Manager deletes a quote request for good with its row version. The request, its photo places, notes
/// and history go in one save with the audit entry, each stored photo is queued for the daily removal job, and the audit entry holds
/// no customer details. Admins cannot delete, a request that became an order cannot be deleted, and a stale version is a 409.
/// </summary>
public sealed class DeleteQuoteRequestTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerDeletesARequestWithItsPhotosNotesAndHistoryForGood()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await SeedFullAsync(rig);
        var keptId = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.New, Received, PhotoNames: ["kept.jpg"], StoredSlots: [0]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.DeleteAsync(manager.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using (var gone = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}/{id:D}"))
        {
            gone.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        (await context.QuoteRequests.CountAsync(request => request.Id == id, token)).ShouldBe(0);
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestNotes.CountAsync(note => note.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == id, token)).ShouldBe(0);
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == keptId, token)).ShouldBe(1);

        var queued = await context.Set<ImageDeletion>().AsNoTracking().ToListAsync(token);
        queued.Select(row => row.PublicId).ShouldBe([QuoteRequestStaffRig.PublicIdOf(id, 0), QuoteRequestStaffRig.PublicIdOf(id, 1)], ignoreOrder: true);
        queued.ShouldAllBe(row => row.Reason == ImageDeletionReason.QuoteDeleted);

        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(audit => audit.Action == "quote-request.deleted" && audit.TargetId == id.ToString("D"), token);
        (entry.TargetType, entry.ActorUserId).ShouldBe(("QuoteRequest", (Guid?)manager.UserId));
        entry.OccurredAtUtc.ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        entry.Detail.ShouldBe("status=contacted;photos=2");
        foreach (var personal in new[] { "Juan", "Dela Cruz", "San Roque", "juan@example.test", "0917", "639171234567", "Twelve jerseys", "front.jpg", "mockup" })
        {
            (entry.Detail ?? string.Empty).ShouldNotContain(personal, Case.Insensitive);
        }
    }

    [Fact]
    public async Task AnAdminCannotDeleteARequest()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Contacted, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.DeleteAsync(rig.Admin.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await AssertStillThereAsync(id);
    }

    [Fact]
    public async Task ARequestThatBecameAnOrderCannotBeDeleted()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Converted, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.DeleteAsync(manager.AccessToken, id, version);
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.converted-locked");
        problem.GetProperty("detail").GetString().ShouldBe("A request that became an order can't be deleted.");
        await AssertStillThereAsync(id);
    }

    [Fact]
    public async Task AStaleVersionIs409AndDeletesNothing()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var stale = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        using (var moved = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "contacted", version = stale }))
        {
            moved.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var response = await rig.DeleteAsync(manager.AccessToken, id, stale);

        (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.Conflict)).GetProperty("code").GetString().ShouldBe("quote-requests.conflict");
        await AssertStillThereAsync(id);
    }

    [Fact]
    public async Task AnUnknownRequestIs404()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);

        using var response = await rig.DeleteAsync(manager.AccessToken, Guid.NewGuid(), "AAAAAAAAB9E=");

        (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.NotFound)).GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-version")]
    public async Task AMissingOrMalformedVersionIs400OnTheVersion(string? version)
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        using var response = await rig.DeleteAsync(manager.AccessToken, id, version);
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.validation");
        problem.GetProperty("errors").GetProperty("version").GetArrayLength().ShouldBe(1);
        await AssertStillThereAsync(id);
    }

    [Fact]
    public async Task AFailureBeforeTheSaveDeletesAndQueuesNothing()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database, factory => factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                var original = services.Single(descriptor => descriptor.ServiceType == typeof(IAuditTrail));
                var implementation = original.ImplementationType.ShouldNotBeNull();
                services.Remove(original);
                services.AddScoped(implementation);
                services.AddScoped<IAuditTrail>(provider => new FailingDeleteAudit((IAuditTrail)provider.GetRequiredService(implementation)));
            })));
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received, PhotoNames: ["a.jpg"], StoredSlots: [0]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();

        using var response = await rig.DeleteAsync(manager.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        await AssertStillThereAsync(id);
        await using var context = database.CreateContext();
        (await context.QuoteRequestPhotos.CountAsync(photo => photo.QuoteRequestId == id && photo.PublicId != null, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    // A Contacted request with a team, email, message, three photo places (two stored), one move and two notes.
    private static async Task<Guid> SeedFullAsync(QuoteRequestStaffRig rig)
    {
        var id = await rig.SeedAsync(new QuoteSeed(
            "Juan Dela Cruz",
            QuoteRequestStatus.New,
            Received,
            Team: "Brgy. San Roque Ballers",
            Email: "juan@example.test",
            Message: "Twelve jerseys, numbers 1 to 12.",
            PhotoNames: ["front.jpg", "back.jpg", "logo.png"],
            StoredSlots: [0, 1]));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        using (var moved = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "contacted", version }))
        {
            moved.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        foreach (var text in new[] { "Called, will send mockup Friday.", "Sent the mockup." })
        {
            using var note = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text });
            note.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        return id;
    }

    private async Task AssertStillThereAsync(Guid id)
    {
        await using var context = database.CreateContext();
        (await context.QuoteRequests.CountAsync(request => request.Id == id, TestContext.Current.CancellationToken)).ShouldBe(1);
        // The audit log is append-only, so the class database keeps other tests' entries: count this request's only.
        var target = id.ToString("D");
        (await context.AuditLog.CountAsync(audit => audit.Action == "quote-request.deleted" && audit.TargetId == target, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    // Fails the delete entry after the photos were queued and the request removed, before the save.
    private sealed class FailingDeleteAudit(IAuditTrail inner) : IAuditTrail
    {
        public void Record(string action, string? targetType, string? targetId, string? detail)
        {
            if (action == "quote-request.deleted")
            {
                throw new InvalidOperationException("The test audit trail failed.");
            }

            inner.Record(action, targetType, targetId, detail);
        }

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            inner.RecordIndependentlyAsync(action, targetType, targetId, detail, cancellationToken);
    }
}
