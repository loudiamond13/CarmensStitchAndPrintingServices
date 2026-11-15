using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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
    public async Task RenamingTheShortNameKeepsTheKeyAndTheLinkAnchor()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var response = await rig.PutAsync(basketball.Id, basketball.ToBody() with { ShortName = "Hoops", Title = "Hoops Jerseys" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await rig.DetailAsync(basketball.Id);
        saved.Key.ShouldBe("basketball");
        saved.ShortName.ShouldBe("Hoops");
        (await rig.PublicKeysAsync()).ShouldBe(SeededKeys);
    }

    [Fact]
    public async Task AShortNameAnotherLineUsesIsRefusedIgnoringLetterCaseAndTrailingSpaces()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        var volleyball = await rig.DetailAsync(lines[1].Id);

        using var added = await rig.PostAsync(LineBody.Shorts with { ShortName = "basketball " });
        using var edited = await rig.PutAsync(volleyball.Id, volleyball.ToBody() with { ShortName = "BASKETBALL" });

        foreach (var response in new[] { added, edited })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("site-content.invalid-request");
            problem.GetProperty("errors").GetProperty("shortName")[0].GetString().ShouldBe("Another product line already uses this short name.");
        }

        (await rig.ListAsync()).Count.ShouldBe(6);
        (await rig.DetailAsync(volleyball.Id)).ShortName.ShouldBe("Volleyball");
    }

    [Fact]
    public async Task ALineKeepsItsOwnShortNameEvenWhenOnlyTheLetterCaseChanges()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var response = await rig.PutAsync(basketball.Id, basketball.ToBody() with { ShortName = "BASKETBALL" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.DetailAsync(basketball.Id)).ShortName.ShouldBe("BASKETBALL");
    }

    [Fact]
    public async Task ASecondLineWithTheSameWordsGetsAKeyWithANumberSuffix()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var first = await rig.AddAsync(LineBody.Shorts);

        var second = await rig.AddAsync(LineBody.Shorts with { ShortName = "Shorts!" });

        first.Key.ShouldBe("shorts");
        second.Key.ShouldBe("shorts-2");
        second.Position.ShouldBe(8);
    }

    [Fact]
    public async Task EditingWithAStaleVersionIs409EditStaleAndChangesNothing()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);
        using var winner = await rig.PutAsync(basketball.Id, basketball.ToBody() with { StartsAtPrice = 650m });
        winner.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var loser = await rig.PutAsync(basketball.Id, basketball.ToBody() with { StartsAtPrice = 700m });

        loser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        (await rig.DetailAsync(basketball.Id)).StartsAtPrice.ShouldBe(650m);
    }

    [Fact]
    public async Task StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManager()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Factory, Roles.Admin);

        using var response = await rig.SendAsync(
            HttpMethod.Post,
            ProductLineRig.Route,
            rig.Manager,
            new
            {
                LineBody.Shorts.Title,
                LineBody.Shorts.ShortName,
                LineBody.Shorts.CardText,
                LineBody.Shorts.Description,
                LineBody.Shorts.FabricText,
                LineBody.Shorts.CollarText,
                LineBody.Shorts.CutText,
                LineBody.Shorts.NamesText,
                LineBody.Shorts.LogosText,
                createdById = other.UserId,
                updatedById = other.UserId,
                createdAtUtc = "2000-01-01T00:00:00Z",
                key = "chosen-by-client",
                position = 1,
            });

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var stored = await context.ProductLines.AsNoTracking().SingleAsync(line => line.Key == "shorts", TestContext.Current.CancellationToken);
        stored.CreatedById.ShouldBe(rig.Manager.UserId);
        stored.CreatedAtUtc.Year.ShouldBeGreaterThanOrEqualTo(2026);
        stored.Position.ShouldBe(7);
    }

    [Fact]
    public async Task ABadFormIs400OnEachFieldWithTheApprovedMessage()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.PostAsync(new LineBody("", "", "123", "", "", "", "", "", "", "", 1.234m, 0m, null, null, null));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var errors = (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("errors");
        errors.GetProperty("title")[0].GetString().ShouldBe("Enter the title.");
        errors.GetProperty("shortName")[0].GetString().ShouldBe("Enter a short name.");
        errors.GetProperty("number")[0].GetString().ShouldBe("Use up to 2 letters or digits, like 23 or 3X.");
        errors.GetProperty("cardText")[0].GetString().ShouldBe("Enter the card text.");
        errors.GetProperty("description")[0].GetString().ShouldBe("Enter the description.");
        errors.GetProperty("fabricText")[0].GetString().ShouldBe("Enter the Fabric text.");
        errors.GetProperty("logosText")[0].GetString().ShouldBe("Enter the Logos & sponsors text.");
        errors.GetProperty("startsAtPrice")[0].GetString().ShouldBe("Use at most 2 decimal places.");
        errors.GetProperty("minimumQuantity")[0].GetString().ShouldBe("Enter a whole number from 1 to 9,999.");
        (await rig.ListAsync()).Count.ShouldBe(6);
    }

    [Fact]
    public async Task PricesAtBothEndsAreStoredAndReturnedExactlyAndOutsideTheEndsAreRefused()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var low = await rig.PutAsync(basketball.Id, basketball.ToBody() with { StartsAtPrice = 0.01m, MinimumQuantity = 1 });
        low.StatusCode.ShouldBe(HttpStatusCode.OK);
        var afterLow = await rig.DetailAsync(basketball.Id);
        (afterLow.StartsAtPrice, afterLow.MinimumQuantity).ShouldBe((0.01m, 1));

        using var high = await rig.PutAsync(basketball.Id, afterLow.ToBody() with { StartsAtPrice = 999_999.99m, MinimumQuantity = 9_999 });
        high.StatusCode.ShouldBe(HttpStatusCode.OK);
        var afterHigh = await rig.DetailAsync(basketball.Id);
        (afterHigh.StartsAtPrice, afterHigh.MinimumQuantity).ShouldBe((999_999.99m, 9_999));

        using var zero = await rig.PutAsync(basketball.Id, afterHigh.ToBody() with { StartsAtPrice = 0.00m });
        using var over = await rig.PutAsync(basketball.Id, afterHigh.ToBody() with { StartsAtPrice = 1_000_000.00m, MinimumQuantity = 10_000 });
        using var threeDecimals = await rig.PutAsync(basketball.Id, afterHigh.ToBody() with { StartsAtPrice = 1.234m });

        zero.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        over.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        threeDecimals.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var overErrors = (await ProblemJson.ReadAsync(over, TestContext.Current.CancellationToken)).GetProperty("errors");
        overErrors.GetProperty("startsAtPrice")[0].GetString().ShouldBe("Enter a price up to ₱999,999.99.");
        overErrors.GetProperty("minimumQuantity")[0].GetString().ShouldBe("Enter a whole number from 1 to 9,999.");
        (await ProblemJson.ReadAsync(threeDecimals, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("startsAtPrice")[0].GetString().ShouldBe("Use at most 2 decimal places.");
        (await rig.DetailAsync(basketball.Id)).StartsAtPrice.ShouldBe(999_999.99m);
    }

    [Fact]
    public async Task TickingAProductTypeFilesItUnderTheLineMovesItFromAnotherLineAndUntickingFreesIt()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var type = await rig.ProductTypeIdAsync("Basketball Jersey");
        var lines = await rig.ListAsync();
        var basketball = await rig.DetailAsync(lines[0].Id);
        var volleyball = await rig.DetailAsync(lines[1].Id);

        using var filed = await rig.PutAsync(basketball.Id, basketball.ToBody() with { ProductTypeIds = [type] });
        filed.StatusCode.ShouldBe(HttpStatusCode.OK, await filed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.LinkedLineOfAsync(type)).ShouldBe(basketball.Id);
        (await rig.DetailAsync(basketball.Id)).ProductTypeIds.ShouldBe([type]);
        (await rig.ListAsync())[0].ProductTypeIds.ShouldBe([type]);
        (await rig.ListAsync())[0].CanDelete.ShouldBeFalse();

        using var moved = await rig.PutAsync(volleyball.Id, volleyball.ToBody() with { ProductTypeIds = [type] });
        moved.StatusCode.ShouldBe(HttpStatusCode.OK, await moved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.LinkedLineOfAsync(type)).ShouldBe(volleyball.Id);
        (await rig.DetailAsync(basketball.Id)).ProductTypeIds.ShouldBeEmpty();

        var freshVolleyball = await rig.DetailAsync(volleyball.Id);
        using var freed = await rig.PutAsync(volleyball.Id, freshVolleyball.ToBody() with { ProductTypeIds = [] });
        freed.StatusCode.ShouldBe(HttpStatusCode.OK, await freed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.LinkedLineOfAsync(type)).ShouldBeNull();

        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.Action == "product-type.line-linked")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        entries.Select(row => row.Detail).ShouldBe(["line=>Basketball Jerseys", "line=Basketball Jerseys>Volleyball Jerseys", "line=Volleyball Jerseys>"]);
        entries.ShouldAllBe(row => row.TargetType == "ProductType" && row.TargetId == type.ToString("D"));
    }

    [Fact]
    public async Task LeavingProductTypeIdsOutOfAnEditKeepsTheLinksAsTheyAre()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var type = await rig.ProductTypeIdAsync("Basketball Jersey");
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);
        using var filed = await rig.PutAsync(basketball.Id, basketball.ToBody() with { ProductTypeIds = [type] });
        filed.StatusCode.ShouldBe(HttpStatusCode.OK);
        var filedBasketball = await rig.DetailAsync(basketball.Id);

        using var response = await rig.PutAsync(basketball.Id, filedBasketball.ToBody() with { ProductTypeIds = null, StartsAtPrice = 650m });

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.LinkedLineOfAsync(type)).ShouldBe(basketball.Id);
    }

    [Fact]
    public async Task AnUnknownProductTypeIs400UnderProductTypeIdsAndNothingChanges()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var response = await rig.PutAsync(basketball.Id, basketball.ToBody() with { ProductTypeIds = [Guid.NewGuid()], StartsAtPrice = 650m });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("productTypeIds")[0].GetString().ShouldBe("Reload the form and try again.");
        (await rig.DetailAsync(basketball.Id)).StartsAtPrice.ShouldBeNull();
    }

    [Fact]
    public async Task AddingALineWithProductTypesFilesThemUnderIt()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var type = await rig.ProductTypeIdAsync("Basketball Jersey");

        var created = await rig.AddAsync(LineBody.Shorts with { ProductTypeIds = [type] });

        created.ProductTypeIds.ShouldBe([type]);
        (await rig.LinkedLineOfAsync(type)).ShouldBe(created.Id);
    }

    [Fact]
    public async Task EachChangingSaveWritesItsAuditEntryAndLongTextsAreNamedNeverCopied()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var added = await rig.AddAsync(LineBody.Shorts);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);
        using var changed = await rig.PutAsync(basketball.Id, basketball.ToBody() with { Title = "Basketball Kits", CardText = "Private card words", StartsAtPrice = 650m, MinimumQuantity = 10 });
        changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var shown = await rig.PutAsync(added.Id, added.ToBody() with { IsActive = true });
        shown.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ProductLine")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

        entries.Select(row => row.Action).ShouldBe(["product-line.added", "product-line.changed", "product-line.shown"]);
        entries[0].Detail.ShouldBe("key=shorts;title=Shorts");
        entries[0].TargetId.ShouldBe(added.Id.ToString("D"));
        entries[1].TargetId.ShouldBe(basketball.Id.ToString("D"));
        entries[1].Detail.ShouldBe("fields=title,cardText,startsAtPrice,minimumQuantity;title=Basketball Jerseys>Basketball Kits;price=>650.00;minimum=>10");
        entries[1].Detail.ShouldNotBeNull().ShouldNotContain("Private card words");
        entries[2].Detail.ShouldBe("key=shorts;title=Shorts");
    }

    [Fact]
    public async Task ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var basketball = await rig.DetailAsync((await rig.ListAsync())[0].Id);

        using var response = await rig.PutAsync(basketball.Id, basketball.ToBody());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await rig.DetailAsync(basketball.Id)).Version.ShouldBe(basketball.Version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ProductLine", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task HidingALineTakesItOffThePublicReadWritesTheAuditAndShowingBringsItBack()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var polo = (await rig.ListAsync())[4];
        var (before, oldEtag) = await rig.PublicLinesAsync();
        before.Dispose();

        using var hidden = await rig.HideAsync(polo.Id);
        using var hiddenAgain = await rig.HideAsync(polo.Id);

        hidden.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        hiddenAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.PublicKeysAsync()).ShouldBe(["basketball", "volleyball", "moto", "longsleeves", "custom"]);
        (await rig.ListAsync())[4].IsActive.ShouldBeFalse();
        var (during, hiddenEtag) = await rig.PublicLinesAsync();
        during.Dispose();
        hiddenEtag.ShouldNotBe(oldEtag);

        using var shown = await rig.ShowAsync(polo.Id);
        using var shownAgain = await rig.ShowAsync(polo.Id);

        shown.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        shownAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.PublicKeysAsync()).ShouldBe(SeededKeys);
        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ProductLine")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        entries.Select(row => row.Action).ShouldBe(["product-line.hidden", "product-line.shown"]);
        entries.ShouldAllBe(row => row.TargetId == polo.Id.ToString("D") && row.Detail == "key=polo;title=Polo Shirts");
    }

    [Fact]
    public async Task HidingOrShowingAnUnknownLineIs404()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var hide = await rig.HideAsync(Guid.NewGuid());
        using var show = await rig.ShowAsync(Guid.NewGuid());

        hide.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        show.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletingALineWithAFiledProductTypeIs422AndNothingIsDeleted()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var type = await rig.ProductTypeIdAsync("Basketball Jersey");
        var volleyball = await rig.DetailAsync((await rig.ListAsync())[1].Id);
        using var filed = await rig.PutAsync(volleyball.Id, volleyball.ToBody() with { ProductTypeIds = [type] });
        filed.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var response = await rig.DeleteAsync(volleyball.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("product-lines.in-use");
        problem.GetProperty("detail").GetString().ShouldBe("This product line is in use. Hide it instead.");
        var lines = await rig.ListAsync();
        lines.Count.ShouldBe(6);
        lines[1].CanDelete.ShouldBeFalse();
        lines.Where(line => line.Id != volleyball.Id).ShouldAllBe(line => line.CanDelete);
    }

    [Fact]
    public async Task DeletingALineWithAPhotoIs422()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var moto = (await rig.ListAsync())[2];
        await using (var context = database.CreateContext())
        {
            context.ProductLinePhotos.Add(Csps.Domain.Content.ProductLinePhoto.Create(moto.Id, Csps.Domain.Content.ProductLinePhotoSlot.Main, "csps/lines/test-photo", 800, 1000, 120_000, "webp", new DateTimeOffset(2026, 11, 12, 9, 0, 0, TimeSpan.Zero)));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        using var response = await rig.DeleteAsync(moto.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("product-lines.in-use");
        var after = (await rig.ListAsync())[2];
        after.PhotoCount.ShouldBe(1);
        after.CanDelete.ShouldBeFalse();
    }

    [Fact]
    public async Task AnUnusedLineIsDeletedWithItsAuditAndASecondDeleteIs404()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var added = await rig.AddAsync(LineBody.Shorts with { IsActive = true });
        (await rig.PublicKeysAsync()).ShouldContain("shorts");
        (await rig.ListAsync()).Single(line => line.Id == added.Id).CanDelete.ShouldBeTrue();

        using var first = await rig.DeleteAsync(added.Id);
        using var second = await rig.DeleteAsync(added.Id);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await rig.PublicKeysAsync()).ShouldBe(SeededKeys);
        (await rig.ListAsync()).Count.ShouldBe(6);
        await using var context = database.CreateContext();
        var deleted = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "product-line.deleted", TestContext.Current.CancellationToken);
        deleted.TargetId.ShouldBe(added.Id.ToString("D"));
        deleted.Detail.ShouldBe("key=shorts;title=Shorts");
    }

    [Fact]
    public async Task AnUnknownLineIs404OnDelete()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.DeleteAsync(Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
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
