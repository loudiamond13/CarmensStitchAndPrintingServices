using System.Net;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// GAL-03, D-14, T-11-72: one manual gallery order across orders and uploads. A move swaps with the visible neighbour (the next item of
/// the line when a line is given), the top item up and the last item down are no-ops, moves run under the site-content lock, and Home's
/// Recent work is not affected.
/// </summary>
public sealed class GalleryMoveTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 12, 0, 0, TimeSpan.Zero);

    // Seeds [upload A (moto), order B (basketball), upload C (moto)] at places 1, 2 and 3.
    private async Task<(Guid A, Guid B, Guid C)> SeedThreeAsync(GalleryAdminRig rig)
    {
        var a = await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Alpha Sample", "moto") { Position = 1 }, Now);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Bravo Sample Ballers") { Position = 2 }], rig.Manager.UserId, Now);
        var c = await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Charlie Sample", "moto") { Position = 3 }, Now);
        var b = (await rig.ListAsync()).Rows.Single(row => row.Kind == "order").Id;
        return (a, b, c);
    }

    private static async Task<Guid[]> OrderAsync(GalleryAdminRig rig, string query = "") => [.. (await rig.ListAsync(query)).Rows.Select(row => row.Id)];

    private static async Task<List<string>> PublicTeamsAsync(GalleryAdminRig rig)
    {
        var (gallery, _) = await rig.PublicGalleryAsync();
        using (gallery)
        {
            return [.. gallery.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("team").GetString()!)];
        }
    }

    private async Task<List<AuditEntry>> MovedAsync(GalleryAdminRig rig)
    {
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.Action == "gallery-item.moved")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task MovingTheLastItemUpSwapsItWithItsNeighbourInTheAdminListAndThePublicGalleryAndWritesTheMovedEntry()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);
        var (before, etagBefore) = await rig.PublicGalleryAsync();
        before.Dispose();

        using var moved = await rig.MoveAsync(c, "up");

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([a, c, b]);
        (await PublicTeamsAsync(rig)).ShouldBe(["Alpha Sample", "Charlie Sample", "Bravo Sample Ballers"]);
        var entry = (await MovedAsync(rig)).ShouldHaveSingleItem();
        (entry.TargetType, entry.TargetId, entry.Detail).ShouldBe(("GalleryEntry", c.ToString("D"), "kind=upload;name=Charlie Sample;position=3>2"));
        var (after, etagAfter) = await rig.PublicGalleryAsync();
        after.Dispose();
        etagAfter.ShouldNotBe(etagBefore);

        using var down = await rig.MoveAsync(a, "down");
        down.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([c, a, b]);
        (await MovedAsync(rig)).Select(row => row.Detail).ShouldBe(["kind=upload;name=Charlie Sample;position=3>2", "kind=upload;name=Alpha Sample;position=1>2"]);
    }

    [Fact]
    public async Task AnOrderItemMovesLikeAnUploadAndItsMovedEntryNamesTheKind()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);

        using var moved = await rig.MoveAsync(b, "down");

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([a, c, b]);
        (await MovedAsync(rig)).ShouldHaveSingleItem().Detail.ShouldBe("kind=order;name=Bravo Sample Ballers;position=2>3");
    }

    [Fact]
    public async Task WithALineFilterTheNeighbourIsTheNextItemOfThatLine()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);
        var moto = GallerySeeding.LineId("moto");

        using var moved = await rig.MoveAsync(c, "up", moto);

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([c, b, a]);
        (await OrderAsync(rig, $"?line={moto:D}")).ShouldBe([c, a]);
        (await MovedAsync(rig)).ShouldHaveSingleItem().Detail.ShouldBe("kind=upload;name=Charlie Sample;position=3>1");
    }

    [Fact]
    public async Task TheTopItemUpAndTheLastItemDownAnswer204WithNoChangeAndNoAuditEntry()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);

        using var top = await rig.MoveAsync(a, "up");
        using var last = await rig.MoveAsync(c, "down");
        using var filteredTop = await rig.MoveAsync(a, "up", GallerySeeding.LineId("moto"));

        new[] { top, last, filteredTop }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([a, b, c]);
        (await MovedAsync(rig)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AMoveAcrossAPageEdgeSwapsWithTheItemOnTheNextPage()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);

        using var moved = await rig.MoveAsync(b, "down");

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync("?page=1&pageSize=2")).Rows.Select(row => row.Id).ShouldBe([a, c]);
        (await rig.ListAsync("?page=2&pageSize=2")).Rows.Select(row => row.Id).ShouldBe([b]);
    }

    [Fact]
    public async Task ADeletedShownOrderIsNotAVisibleNeighbour()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var a = await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Alpha Sample", "moto") { Position = 1 }, Now);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Deleted Sample Team") { Position = 2, Deleted = true }], rig.Manager.UserId, Now);
        var c = await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Charlie Sample", "moto") { Position = 3 }, Now);

        using var moved = await rig.MoveAsync(c, "up");

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([c, a]);
        (await MovedAsync(rig)).ShouldHaveSingleItem().Detail.ShouldBe("kind=upload;name=Charlie Sample;position=2>1");
    }

    [Fact]
    public async Task ANewlyShownOrderGoesAboveEverythingAndANewUploadGoesAboveThat()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, _, c) = await SeedThreeAsync(rig);
        var shown = await rig.Orders.ShowOrderAsync("Delta Sample Ballers", [5], (800, 600));

        var afterOrder = (await rig.ListAsync()).Rows;
        var upload = await rig.AddAsync(UploadForm.Riders);
        var afterUpload = (await rig.ListAsync()).Rows;

        afterOrder.First().OrderId.ShouldBe(shown);
        afterOrder.Count.ShouldBe(4);
        afterUpload.First().Id.ShouldBe(upload.Id);
        afterUpload.Select(row => row.Id).ShouldContain(a);
        afterUpload.Last().Id.ShouldBe(c);
    }

    [Fact]
    public async Task ABadDirectionIs400AndAnUnknownItemOrOneOutsideTheLineFilterIs404WithNothingChanged()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);

        using var sideways = await rig.MoveAsync(c, "sideways");
        using var noBody = await rig.SendAsync(HttpMethod.Post, $"{GalleryAdminRig.Route}/{c:D}/move", rig.Manager);
        using var unknown = await rig.MoveAsync(Guid.NewGuid(), "up");
        using var outside = await rig.MoveAsync(b, "up", GallerySeeding.LineId("moto"));
        using var noSuchLine = await rig.MoveAsync(c, "up", Guid.NewGuid());

        sideways.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        noBody.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        outside.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        noSuchLine.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("gallery-items.not-found");
        (await OrderAsync(rig)).ShouldBe([a, b, c]);
        (await MovedAsync(rig)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheSameMoveSentTwiceWithOneIdempotencyKeyMovesOnce()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, b, c) = await SeedThreeAsync(rig);
        var key = Guid.NewGuid().ToString("D");

        using var first = await rig.MoveAsync(c, "up", idempotencyKey: key);
        using var second = await rig.MoveAsync(c, "up", idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderAsync(rig)).ShouldBe([a, c, b]);
        (await MovedAsync(rig)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ManyMovesAtTheSameTimeLeaveEveryPlaceUsedOnceAndTheListAPermutation()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        List<Guid> ids = [];
        for (var index = 0; index < 6; index++)
        {
            ids.Add(await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload($"Race Sample {index}", "moto") { Position = index + 1 }, Now));
        }

        for (var round = 0; round < 4; round++)
        {
            var moves = ids.Select((id, index) => Task.Run(() => rig.MoveAsync(id, index % 2 == 0 ? "up" : "down"), TestContext.Current.CancellationToken)).ToArray();
            var responses = await Task.WhenAll(moves);
            responses.ShouldAllBe(response => response.StatusCode == HttpStatusCode.NoContent);
            foreach (var response in responses)
            {
                response.Dispose();
            }

            await using var context = database.CreateContext();
            var positions = await context.GalleryEntries.AsNoTracking().Select(entry => entry.Position).ToListAsync(TestContext.Current.CancellationToken);
            positions.Distinct().Count().ShouldBe(6, $"round {round}");
            positions.Order().ShouldBe([1, 2, 3, 4, 5, 6]);
            (await OrderAsync(rig)).Order().ShouldBe(ids.Order());
        }
    }

    [Fact]
    public async Task MovingTheGalleryDoesNotChangeHomesRecentWorkOrder()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        await rig.Orders.ShowOrderAsync("First Shown Sample", [5], (800, 600));
        await rig.Orders.ShowOrderAsync("Second Shown Sample", [5], (800, 600));
        var recent = async () =>
        {
            var (home, _) = await rig.Orders.PublicHomeAsync();
            using (home)
            {
                return home.RootElement.GetProperty("recentWork").EnumerateArray().Select(tile => tile.GetProperty("team").GetString()).ToList();
            }
        };
        var before = await recent();
        var secondShown = (await rig.ListAsync()).Rows.First();

        using var moved = await rig.MoveAsync(secondShown.Id, "down");

        moved.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        before.ShouldBe(["Second Shown Sample", "First Shown Sample"]);
        (await PublicTeamsAsync(rig)).ShouldBe(["First Shown Sample", "Second Shown Sample"]);
        (await recent()).ShouldBe(before);
    }

    [Fact]
    public async Task AnAdminGets403OnTheMoveRoute()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var (a, _, c) = await SeedThreeAsync(rig);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);

        using var response = await rig.MoveAsync(c, "up", who: admin);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await OrderAsync(rig)).First().ShouldBe(a);
    }
}
