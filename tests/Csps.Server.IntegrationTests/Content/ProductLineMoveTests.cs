using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-02, PUB-03, T-11-43: a line moves one place up or down in the display order. The swap runs under the site-content lock, a move
/// at the end changes nothing, the same move sent twice with one Idempotency-Key moves once, and two Managers moving at the same moment
/// end with every position used exactly once.
/// </summary>
public sealed class ProductLineMoveTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] SeededKeys = ["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"];

    [Fact]
    public async Task MovingVolleyballUpSwapsItWithBasketballChangesThePublicOrderAndTheETagAndWritesTheMoveAudit()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        var (before, oldEtag) = await rig.PublicLinesAsync();
        before.Dispose();

        using var response = await rig.MoveAsync(lines[1].Id, "up");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var after = await rig.ListAsync();
        after.Select(line => line.Key).ShouldBe(["volleyball", "basketball", "moto", "longsleeves", "polo", "custom"]);
        after.Select(line => line.Position).ShouldBe([1, 2, 3, 4, 5, 6]);
        var (document, newEtag) = await rig.PublicLinesAsync();
        using (document)
        {
            document.RootElement.GetProperty("lines").EnumerateArray().Select(line => line.GetProperty("key").GetString()).ShouldBe(["volleyball", "basketball", "moto", "longsleeves", "polo", "custom"]);
        }

        newEtag.ShouldNotBe(oldEtag);
        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ProductLine")
            .ToListAsync(TestContext.Current.CancellationToken);
        var moved = entries.ShouldHaveSingleItem();
        moved.Action.ShouldBe("product-line.moved");
        moved.TargetId.ShouldBe(lines[1].Id.ToString("D"));
        moved.Detail.ShouldBe("title=Volleyball Jerseys;position=2>1");
    }

    [Fact]
    public async Task MovingALineDownSwapsItWithTheNextOne()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();

        using var response = await rig.MoveAsync(lines[0].Id, "DOWN");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(line => line.Key).ShouldBe(["volleyball", "basketball", "moto", "longsleeves", "polo", "custom"]);
    }

    [Fact]
    public async Task MovingTheFirstLineUpOrTheLastLineDownIs204ChangesNothingAndWritesNoAudit()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        var (before, oldEtag) = await rig.PublicLinesAsync();
        before.Dispose();

        using var first = await rig.MoveAsync(lines[0].Id, "up");
        using var last = await rig.MoveAsync(lines[5].Id, "down");

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        last.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(line => line.Key).ShouldBe(SeededKeys);
        var (after, newEtag) = await rig.PublicLinesAsync();
        after.Dispose();
        newEtag.ShouldBe(oldEtag);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ProductLine", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheSameMovePostedTwiceWithOneIdempotencyKeyMovesOnce()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        var key = Guid.NewGuid().ToString("D");

        using var first = await rig.MoveAsync(lines[1].Id, "up", idempotencyKey: key);
        using var repeat = await rig.MoveAsync(lines[1].Id, "up", idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        repeat.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(line => line.Key).ShouldBe(["volleyball", "basketball", "moto", "longsleeves", "polo", "custom"]);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "product-line.moved", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TwoManagersMovingTwoLinesAtTheSameMomentEndWithEveryPositionUsedOnce()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        var lines = await rig.ListAsync();

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => rig.MoveAsync(lines[1].Id, "up"),
            () => rig.MoveAsync(lines[2].Id, "up", other));
        using (first)
        using (second)
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var after = await rig.ListAsync();
        after.Select(line => line.Position).Order().ShouldBe([1, 2, 3, 4, 5, 6]);
        after.Select(line => line.Key).Order().ShouldBe(SeededKeys.Order());

        // Either order of the two moves is a valid outcome: moving Moto up and then Volleyball up puts the two lines back where they were.
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.Action == "product-line.moved" && (row.ActorUserId == rig.Manager.UserId || row.ActorUserId == other.UserId), TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    [Fact]
    public async Task AMoveSwapsWithTheNextLineEvenWhenItIsHidden()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        using var hidden = await rig.HideAsync(lines[0].Id);
        hidden.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await rig.MoveAsync(lines[1].Id, "up");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(line => line.Key).ShouldBe(["volleyball", "basketball", "moto", "longsleeves", "polo", "custom"]);
        (await rig.PublicKeysAsync()).ShouldBe(["volleyball", "moto", "longsleeves", "polo", "custom"]);
    }

    [Fact]
    public async Task AMoveOfAnUnknownLineIs404AndABadDirectionIs400UnderDirection()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();

        using var missing = await rig.MoveAsync(Guid.NewGuid(), "up");
        using var sideways = await rig.MoveAsync(lines[1].Id, "sideways");

        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        sideways.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(sideways, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("direction")[0].GetString().ShouldBe("Check the highlighted fields.");
        (await rig.ListAsync()).Select(line => line.Key).ShouldBe(SeededKeys);
    }
}
