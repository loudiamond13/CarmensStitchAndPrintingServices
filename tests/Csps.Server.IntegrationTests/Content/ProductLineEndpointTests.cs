using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-02, PUB-03, D-01, D-04, D-34: a Manager lists, reads, adds and edits product lines through <c>/api/v1/product-lines</c> and the
/// public Products data follows each change at once. An Admin gets 403 on every route. The six migrated lines are put back before each test.
/// </summary>
public sealed class ProductLineEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] SeededKeys = ["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"];

    [Fact]
    public async Task AManagerListsTheSixLinesInOrderWithTheirVersions()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        var lines = await rig.ListAsync();

        lines.Select(line => line.Key).ShouldBe(SeededKeys);
        lines.Select(line => line.Position).ShouldBe([1, 2, 3, 4, 5, 6]);
        lines.ShouldAllBe(line => line.IsActive && line.Version.Length > 0 && line.StartsAtPrice == null && line.MinimumQuantity == null);
        lines.ShouldAllBe(line => line.MainPhotoThumb == null && line.ShownGalleryCount == 0 && line.PhotoCount == 0 && line.ProductTypeIds.Length == 0 && line.CanDelete);
    }

    [Fact]
    public async Task AManagerReadsOneLineWithEveryField()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = (await rig.ListAsync())[0];

        var detail = await rig.DetailAsync(basketball.Id);

        detail.Key.ShouldBe("basketball");
        detail.Title.ShouldBe("Basketball Jerseys");
        detail.ShortName.ShouldBe("Basketball");
        detail.Number.ShouldBe("23");
        detail.FabricText.ShouldBe("Dri-fit mesh, aircool or spandex blend");
        detail.PlaceholderArt.ShouldBe("basketball");
        detail.Version.ShouldBe(basketball.Version);
        detail.UpdatedByName.ShouldBeNull();
    }

    [Fact]
    public async Task APriceOnBasketballReachesThePublicProductsDataWithANewETag()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var (before, oldEtag) = await rig.PublicLinesAsync();
        before.Dispose();
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var response = await rig.PutAsync(basketball.Id, basketball.ToBody() with { StartsAtPrice = 650.00m, MinimumQuantity = 10 });

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var (after, newEtag) = await rig.PublicLinesAsync();
        using (after)
        {
            var line = after.RootElement.GetProperty("lines")[0];
            line.GetProperty("key").GetString().ShouldBe("basketball");
            line.GetProperty("startsAtPrice").GetDecimal().ShouldBe(650.00m);
            line.GetProperty("minimumQuantity").GetInt32().ShouldBe(10);
        }

        newEtag.ShouldNotBe(oldEtag);
        (await rig.DetailAsync(basketball.Id)).Version.ShouldNotBe(basketball.Version);
    }

    [Fact]
    public async Task ANewLineStartsHiddenAtTheEndWithTheCustomDrawingAndIsNotPublicUntilShown()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.PostAsync(LineBody.Shorts);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        response.Headers.Location.ShouldNotBeNull();
        var created = (await rig.ListAsync()).Single(line => line.Key == "shorts");
        created.IsActive.ShouldBeFalse();
        created.Position.ShouldBe(7);
        var detail = await rig.DetailAsync(created.Id);
        detail.PlaceholderArt.ShouldBe("custom");
        detail.Title.ShouldBe("Shorts");
        (await rig.PublicKeysAsync()).ShouldBe(SeededKeys);

        using var shown = await rig.PutAsync(detail.Id, detail.ToBody() with { IsActive = true });

        shown.StatusCode.ShouldBe(HttpStatusCode.OK, await shown.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.PublicKeysAsync()).ShouldBe([.. SeededKeys, "shorts"]);
    }

    [Fact]
    public async Task ATickedShowFlagOnANewLineMakesItPublicAtOnce()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        await rig.AddAsync(LineBody.Shorts with { IsActive = true });

        (await rig.PublicKeysAsync()).ShouldBe([.. SeededKeys, "shorts"]);
    }

    [Fact]
    public async Task AnAdminGets403OnEveryRouteAndNothingChanges()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        var responses = new[]
        {
            await rig.GetListAsync(admin),
            await rig.GetOneAsync(basketball.Id, admin),
            await rig.PostAsync(LineBody.Shorts, admin),
            await rig.PutAsync(basketball.Id, basketball.ToBody() with { StartsAtPrice = 1m }, admin),
            await rig.MoveAsync(basketball.Id, "down", admin),
            await rig.HideAsync(basketball.Id, admin),
            await rig.ShowAsync(basketball.Id, admin),
            await rig.DeleteAsync(basketball.Id, admin),
        };
        try
        {
            responses.ShouldAllBe(response => response.StatusCode == HttpStatusCode.Forbidden);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }

        var after = await rig.ListAsync();
        after.Count.ShouldBe(6);
        after[0].StartsAtPrice.ShouldBeNull();
        after[0].IsActive.ShouldBeTrue();
        (await rig.DetailAsync(basketball.Id)).Version.ShouldBe(basketball.Version);
    }

    [Fact]
    public async Task AnUnknownLineIs404OnReadAndOnEdit()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var read = await rig.GetOneAsync(Guid.NewGuid());
        using var edit = await rig.PutAsync(Guid.NewGuid(), LineBody.Shorts with { Version = Convert.ToBase64String(new byte[8]) });

        read.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        using var problem = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        problem.RootElement.GetProperty("code").GetString().ShouldBe("product-lines.not-found");
        problem.RootElement.GetProperty("detail").GetString().ShouldBe("This product line wasn't found.");
    }
}
