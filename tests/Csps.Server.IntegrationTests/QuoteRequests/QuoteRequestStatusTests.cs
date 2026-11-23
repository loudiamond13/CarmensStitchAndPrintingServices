using System.Net;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>
/// INQ-05, D-14, D-15, SEC-07, SEC-08: staff move a request freely between the five hand-set statuses with its row version; each move is
/// one history row and one audit entry, Converted is never set or left by hand, and a stale version is a 409.
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

        body.GetProperty("status").GetString().ShouldBe("contacted");
        body.GetProperty("version").GetString().ShouldNotBe(version);
        var history = body.GetProperty("history").EnumerateArray().ToList();
        history.Count.ShouldBe(2);
        history[0].GetProperty("from").GetString().ShouldBe("new");
        history[0].GetProperty("to").GetString().ShouldBe("contacted");
        history[0].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        history[1].GetProperty("to").GetString().ShouldBe("new");
        body.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
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
        body.GetProperty("history")[0].GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
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

    private static async Task<int> NewCountAsync(QuoteRequestStaffRig rig)
    {
        using var response = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}/new-count");
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);
        return body.GetProperty("count").GetInt32();
    }
}
