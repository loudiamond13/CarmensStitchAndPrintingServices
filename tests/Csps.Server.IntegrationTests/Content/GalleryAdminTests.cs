using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// GAL-03, D-10, D-08, T-11-70, T-11-71: a Manager adds photos of older work to the public Gallery, and manages them, through
/// <c>/api/v1/gallery-items</c>. The file is checked and stored under a random id in the content folder, never the orders folder, and the
/// public gallery shows the upload at once.
/// </summary>
public sealed class GalleryAdminTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int RaceRounds = 10;

    private static readonly DateTimeOffset Now = new(2026, 11, 12, 12, 0, 0, TimeSpan.Zero);

    private static readonly byte[] Photo = SyntheticImages.Jpeg(800, 600);

    [Fact]
    public async Task AManagerUploadsAPhotoForOlderWorkAndItIsFirstInTheAdminListAndThePublicGallery()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Brgy. Sample Ballers") { Position = 5 }], rig.Manager.UserId, Now);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await rig.UploadAsync(UploadForm.Riders, Photo);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var answer = JsonDocument.Parse(text);
        var id = answer.RootElement.GetProperty("id").GetGuid();
        answer.RootElement.GetProperty("kind").GetString().ShouldBe("upload");
        answer.RootElement.GetProperty("name").GetString().ShouldBe("Tondo Sample Riders");
        answer.RootElement.GetProperty("version").GetString().ShouldNotBeNullOrWhiteSpace();

        var upload = storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/gallery/", StringComparison.Ordinal)).ShouldHaveSingleItem();
        upload.AssetFolder.ShouldBe($"csps-test/content/gallery/{id:D}");
        Regex.IsMatch(upload.PublicId, $"^csps-test/content/gallery/{id:D}/[a-z2-7]{{26}}$").ShouldBeTrue(upload.PublicId);
        upload.PublicId.ShouldNotContain("/orders/");

        await using (var context = database.CreateContext())
        {
            var row = await context.GalleryEntries.AsNoTracking().SingleAsync(entry => entry.Id == id, TestContext.Current.CancellationToken);
            row.Kind.ShouldBe(GalleryEntryKind.Upload);
            row.PublicId.ShouldBe(upload.PublicId);
            (row.Width, row.Height, row.Bytes, row.Format).ShouldBe((800, 600, Photo.Length, "jpg"));
            (row.TeamName, row.ProductLineId, row.Pieces, row.Note, row.IsShown).ShouldBe(("Tondo Sample Riders", GallerySeeding.LineId("moto"), 12, "Dri-fit mesh, V-neck", true));
            row.CreatedById.ShouldBe(rig.Manager.UserId);
        }

        var page = await rig.ListAsync();
        page.Total.ShouldBe(2);
        page.Rows.Select(row => row.Kind).ShouldBe(["upload", "order"]);
        var first = page.Rows[0];
        (first.Id, first.Name, first.LineShortName, first.LineHidden, first.Pieces, first.IsShown, first.Note).ShouldBe((id, "Tondo Sample Riders", "Moto", false, 12, true, "Dri-fit mesh, V-neck"));
        first.OrderId.ShouldBeNull();
        first.OrderNumber.ShouldBeNull();
        first.Thumb.ShouldNotBeNullOrWhiteSpace();
        var order = page.Rows[1];
        (order.Name, order.LineShortName, order.Pieces, order.IsShown).ShouldBe(("Brgy. Sample Ballers", "Basketball", 10, true));
        order.OrderNumber.ShouldStartWith("ORD-2026-");
        order.Version.ShouldBeNull();

        var (gallery, _) = await rig.PublicGalleryAsync();
        using (gallery)
        {
            var items = gallery.RootElement.GetProperty("items").EnumerateArray().ToList();
            items.Count.ShouldBe(2);
            var top = items[0];
            top.GetProperty("id").GetGuid().ShouldBe(id);
            top.GetProperty("team").GetString().ShouldBe("Tondo Sample Riders");
            top.GetProperty("lineKey").GetString().ShouldBe("moto");
            top.GetProperty("pieces").GetInt32().ShouldBe(12);
            top.GetProperty("note").GetString().ShouldBe("Dri-fit mesh, V-neck");
            top.GetProperty("photos").EnumerateArray().ShouldHaveSingleItem();
            items[1].GetProperty("note").ValueKind.ShouldBe(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task AnAdminGets403OnTheListAndTheUploadAndNothingIsStored()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var list = await rig.GetListAsync(who: admin);
        using var upload = await rig.UploadAsync(UploadForm.Riders, Photo, admin);

        list.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        upload.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.GalleryEntries.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnUploadWithNoPhotoNoTeamAndNoLineIsRefusedWithTheMessagesAndNothingIsStored()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var noPhoto = await rig.UploadAsync(UploadForm.Riders, file: null);
        using var empty = await rig.UploadAsync(new UploadForm(null, null, null, null, null), Photo);

        noPhoto.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var photoProblem = await ProblemJson.ReadAsync(noPhoto, TestContext.Current.CancellationToken);
        photoProblem.GetProperty("errors").GetProperty("file").EnumerateArray().Select(item => item.GetString()).ShouldBe(["Choose a photo."]);
        empty.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(empty, TestContext.Current.CancellationToken);
        var errors = problem.GetProperty("errors");
        errors.GetProperty("teamName").EnumerateArray().Select(item => item.GetString()).ShouldBe(["Enter the team or name."]);
        errors.GetProperty("productLineId").EnumerateArray().Select(item => item.GetString()).ShouldBe(["Choose the product line."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.GalleryEntries.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnEmptyGalleryListAnswers200WithNoRowsAndTotalZeroAndAnUploadWithoutPiecesIsPublicWithPiecesNull()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);

        var empty = await rig.ListAsync();
        empty.Rows.ShouldBeEmpty();
        (empty.Total, empty.Page, empty.Size).ShouldBe((0, 1, 20));

        var added = await rig.AddAsync(UploadForm.Riders with { Pieces = null, Note = null });
        added.Pieces.ShouldBeNull();
        added.Note.ShouldBeNull();

        var (gallery, _) = await rig.PublicGalleryAsync();
        using (gallery)
        {
            var item = gallery.RootElement.GetProperty("items").EnumerateArray().ShouldHaveSingleItem();
            item.GetProperty("pieces").ValueKind.ShouldBe(JsonValueKind.Null);
            item.GetProperty("note").ValueKind.ShouldBe(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task EditingTheTeamAndNoteWithTheVersionSavesAndAuditsNoteChangedWithoutTheNoteText()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);

        using var response = await rig.UpdateAsync(added.Id, new { teamName = "Tondo Sample Riders MC", productLineId = GallerySeeding.LineId("moto"), pieces = 12, note = "A private sample sentence", isShown = true, version = added.Version });
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var answer = JsonDocument.Parse(text);
        answer.RootElement.GetProperty("name").GetString().ShouldBe("Tondo Sample Riders MC");
        answer.RootElement.GetProperty("note").GetString().ShouldBe("A private sample sentence");
        answer.RootElement.GetProperty("version").GetString().ShouldNotBe(added.Version);
        var changed = (await AuditAsync(rig, "gallery-photo.changed")).ShouldHaveSingleItem();
        changed.Detail.ShouldBe("fields=team,note;team=Tondo Sample Riders>Tondo Sample Riders MC");
        changed.Detail!.ShouldNotContain("private");
        (changed.TargetType, changed.TargetId).ShouldBe(("GalleryEntry", added.Id.ToString("D")));
        var (gallery, _) = await rig.PublicGalleryAsync();
        using (gallery)
        {
            gallery.RootElement.GetProperty("items")[0].GetProperty("team").GetString().ShouldBe("Tondo Sample Riders MC");
        }
    }

    [Fact]
    public async Task AStaleVersionIs409AndAFormWithNoChangeKeepsTheVersionAndWritesNoEntry()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);
        var same = new { teamName = "Tondo Sample Riders", productLineId = GallerySeeding.LineId("moto"), pieces = 12, note = "Dri-fit mesh, V-neck", isShown = true, version = added.Version };
        using var unchanged = await rig.UpdateAsync(added.Id, same);
        using var first = await rig.UpdateAsync(added.Id, same with { teamName = "Second Name" });
        using var stale = await rig.UpdateAsync(added.Id, same with { teamName = "Third Name" });

        unchanged.StatusCode.ShouldBe(HttpStatusCode.OK);
        using (var document = JsonDocument.Parse(await unchanged.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            document.RootElement.GetProperty("version").GetString().ShouldBe(added.Version);
        }

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        (await AuditAsync(rig, "gallery-photo.changed")).Count.ShouldBe(1);
        (await rig.ListAsync()).Rows.ShouldHaveSingleItem().Name.ShouldBe("Second Name");
    }

    [Fact]
    public async Task EditRulesGiveTheExactMessagesAndClientStampsAreIgnored()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);
        var valid = new { teamName = "Tondo Sample Riders", productLineId = GallerySeeding.LineId("moto"), pieces = 12, note = "Dri-fit mesh, V-neck", isShown = true, version = added.Version };

        using var badPieces = await rig.UpdateAsync(added.Id, valid with { pieces = 10000 });
        using var zeroPieces = await rig.UpdateAsync(added.Id, valid with { pieces = 0 });
        using var longTeam = await rig.UpdateAsync(added.Id, valid with { teamName = new string('t', 81) });
        using var longNote = await rig.UpdateAsync(added.Id, valid with { note = new string('n', 121) });
        using var unknownLine = await rig.UpdateAsync(added.Id, valid with { productLineId = Guid.NewGuid() });
        using var emptyBody = await rig.SendAsync(HttpMethod.Put, $"{GalleryAdminRig.Route}/{added.Id:D}", rig.Manager);
        using var stamped = await rig.UpdateAsync(added.Id, new { valid.teamName, valid.productLineId, pieces = 9999, valid.note, valid.isShown, valid.version, createdById = Guid.NewGuid(), createdAtUtc = "2020-01-01T00:00:00Z", updatedById = Guid.NewGuid() });

        (await FieldMessageAsync(badPieces, "pieces")).ShouldBe("Enter a whole number from 1 to 9,999.");
        (await FieldMessageAsync(zeroPieces, "pieces")).ShouldBe("Enter a whole number from 1 to 9,999.");
        (await FieldMessageAsync(longTeam, "teamName")).ShouldBe("Keep this to 80 characters or fewer.");
        (await FieldMessageAsync(longNote, "note")).ShouldBe("Keep the note to 120 characters or fewer.");
        (await FieldMessageAsync(unknownLine, "productLineId")).ShouldBe("Choose the product line.");
        emptyBody.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        stamped.StatusCode.ShouldBe(HttpStatusCode.OK, await stamped.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.GalleryEntries.AsNoTracking().SingleAsync(entry => entry.Id == added.Id, TestContext.Current.CancellationToken);
        (row.Pieces, row.CreatedById, row.UpdatedById).ShouldBe((9999, rig.Manager.UserId, rig.Manager.UserId));
        row.CreatedAtUtc.Year.ShouldBeGreaterThan(2020);
    }

    [Fact]
    public async Task ReplacingThePhotoQueuesTheOldFileAndAuditsAPhotoChangeWithoutTheAddress()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);
        string oldId;
        await using (var before = database.CreateContext())
        {
            oldId = await before.GalleryEntries.AsNoTracking().Where(entry => entry.Id == added.Id).Select(entry => entry.PublicId!).SingleAsync(TestContext.Current.CancellationToken);
        }

        using var response = await rig.ReplacePhotoAsync(added.Id, SyntheticImages.Jpeg(900, 900));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        await using var context = database.CreateContext();
        var row = await context.GalleryEntries.AsNoTracking().SingleAsync(entry => entry.Id == added.Id, TestContext.Current.CancellationToken);
        row.PublicId.ShouldNotBe(oldId);
        row.PublicId.ShouldStartWith($"csps-test/content/gallery/{added.Id:D}/");
        (row.Width, row.Height).ShouldBe((900, 900));
        var queued = await context.Set<ImageDeletion>().AsNoTracking().Where(deletion => deletion.PublicId == oldId).ToListAsync(TestContext.Current.CancellationToken);
        queued.ShouldHaveSingleItem().Reason.ShouldBe(ImageDeletionReason.PhotoReplaced);
        var changed = (await AuditAsync(rig, "gallery-photo.changed")).ShouldHaveSingleItem();
        changed.Detail.ShouldBe("fields=photo");
        changed.Detail!.ShouldNotContain(row.PublicId);
        using var answer = JsonDocument.Parse(text);
        answer.RootElement.GetProperty("version").GetString().ShouldNotBe(added.Version);
        using var noFile = await rig.ReplacePhotoAsync(added.Id, file: null);
        noFile.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await FieldMessageAsync(noFile, "file")).ShouldBe("Choose a photo.");
    }

    [Fact]
    public async Task HidingTakesAnUploadOffThePublicGalleryAndShowingBringsItBackEachWithItsAuditEntry()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);

        using var hidden = await rig.HideAsync(added.Id);
        using var hiddenAgain = await rig.HideAsync(added.Id);
        var afterHide = await rig.ListAsync();
        var (publicHidden, etagHidden) = await rig.PublicGalleryAsync();
        using (publicHidden)
        {
            publicHidden.RootElement.GetProperty("items").GetArrayLength().ShouldBe(0);
        }

        using var shown = await rig.ShowAsync(added.Id);
        using var shownAgain = await rig.ShowAsync(added.Id);
        var (publicShown, etagShown) = await rig.PublicGalleryAsync();
        using (publicShown)
        {
            publicShown.RootElement.GetProperty("items").GetArrayLength().ShouldBe(1);
        }

        new[] { hidden, hiddenAgain, shown, shownAgain }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.NoContent);
        afterHide.Rows.ShouldHaveSingleItem().IsShown.ShouldBeFalse();
        etagShown.ShouldNotBe(etagHidden);
        (await AuditAsync(rig, "gallery-photo.hidden")).ShouldHaveSingleItem().Detail.ShouldBe("team=Tondo Sample Riders;line=Moto Riding Jerseys");
        (await AuditAsync(rig, "gallery-photo.shown")).ShouldHaveSingleItem().Detail.ShouldBe("team=Tondo Sample Riders;line=Moto Riding Jerseys");
    }

    [Fact]
    public async Task DeletingAnUploadAnswers204QueuesItsPhotoAuditsItAndTheSecondDeleteIs404()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);
        string photoId;
        await using (var before = database.CreateContext())
        {
            photoId = await before.GalleryEntries.AsNoTracking().Where(entry => entry.Id == added.Id).Select(entry => entry.PublicId!).SingleAsync(TestContext.Current.CancellationToken);
        }

        using var deleted = await rig.DeleteAsync(added.Id);
        using var again = await rig.DeleteAsync(added.Id);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        again.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        await using var context = database.CreateContext();
        (await context.GalleryEntries.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.Set<ImageDeletion>().AsNoTracking().SingleAsync(row => row.PublicId == photoId, TestContext.Current.CancellationToken)).Reason.ShouldBe(ImageDeletionReason.PhotoDeleted);
        (await AuditAsync(rig, "gallery-photo.deleted")).ShouldHaveSingleItem().Detail.ShouldBe("team=Tondo Sample Riders;line=Moto Riding Jerseys");
        (await rig.ListAsync()).Rows.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnOrderItemHasNoEditReplaceHideShowOrDeleteRouteAndAnswers404WithNothingChanged()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Brgy. Sample Ballers") { Position = 5 }], rig.Manager.UserId, Now);
        var order = (await rig.ListAsync()).Rows.ShouldHaveSingleItem();
        var version = Convert.ToBase64String(new byte[8]);

        using var edit = await rig.UpdateAsync(order.Id, new { teamName = "Changed", productLineId = GallerySeeding.LineId("moto"), isShown = true, version });
        using var replace = await rig.ReplacePhotoAsync(order.Id, Photo);
        using var hide = await rig.HideAsync(order.Id);
        using var show = await rig.ShowAsync(order.Id);
        using var delete = await rig.DeleteAsync(order.Id);

        new[] { edit, replace, hide, show, delete }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(delete, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("gallery-items.not-found");
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        var still = (await rig.ListAsync()).Rows.ShouldHaveSingleItem();
        (still.Name, still.IsShown, still.OrderNumber).ShouldBe(("Brgy. Sample Ballers", true, order.OrderNumber));
    }

    [Fact]
    public async Task UploadingForAHiddenLineSucceedsButStaysOffThePublicSiteAndTheListFlagsLineHiddenAndALineWithUploadsCannotBeDeleted()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var moto = GallerySeeding.LineId("moto");
        using var hide = await rig.SendAsync(HttpMethod.Post, $"/api/v1/product-lines/{moto:D}/hide", rig.Manager);
        hide.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var added = await rig.AddAsync(UploadForm.Riders);

        added.LineHidden.ShouldBeTrue();
        (await rig.ListAsync()).Rows.ShouldHaveSingleItem().LineHidden.ShouldBeTrue();
        var (gallery, _) = await rig.PublicGalleryAsync();
        using (gallery)
        {
            gallery.RootElement.GetProperty("items").GetArrayLength().ShouldBe(0);
        }

        using var blocked = await rig.SendAsync(HttpMethod.Delete, $"/api/v1/product-lines/{moto:D}", rig.Manager);
        blocked.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(blocked, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("product-lines.in-use");
    }

    [Fact]
    public async Task AnAdminGets403OnEveryEditReplaceHideShowAndDeleteRoute()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var added = await rig.AddAsync(UploadForm.Riders);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);

        using var edit = await rig.UpdateAsync(added.Id, new { teamName = "Changed", productLineId = GallerySeeding.LineId("moto"), version = added.Version }, admin);
        using var replace = await rig.ReplacePhotoAsync(added.Id, Photo, admin);
        using var hide = await rig.HideAsync(added.Id, admin);
        using var show = await rig.ShowAsync(added.Id, admin);
        using var delete = await rig.DeleteAsync(added.Id, admin);

        new[] { edit, replace, hide, show, delete }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.Forbidden);
        (await rig.ListAsync()).Rows.ShouldHaveSingleItem().Name.ShouldBe("Tondo Sample Riders");
    }

    [Fact]
    public async Task AnUploadFormWithPiecesThatAreNotANumberOrOutOfRangeIsRefusedWithThePiecesMessage()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);

        foreach (var pieces in new[] { "abc", "0", "10000", "2.5" })
        {
            using var response = await rig.UploadAsync(UploadForm.Riders with { Pieces = pieces }, Photo);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, pieces);
            (await FieldMessageAsync(response, "pieces")).ShouldBe("Enter a whole number from 1 to 9,999.");
        }

        using var longTeam = await rig.UploadAsync(UploadForm.Riders with { Team = new string('t', 81) }, Photo);
        using var longNote = await rig.UploadAsync(UploadForm.Riders with { Note = new string('n', 121) }, Photo);
        (await FieldMessageAsync(longTeam, "teamName")).ShouldBe("Keep this to 80 characters or fewer.");
        (await FieldMessageAsync(longNote, "note")).ShouldBe("Keep the note to 120 characters or fewer.");
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        (await rig.ListAsync()).Rows.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnSvgNamedAsAJpegAFileOverTenMegabytesAndAPhotoWithTooManyPixelsAreRefusedWithThePhaseNineMessagesAndNothingIsStored()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var big = new byte[Csps.Application.Images.ImageUploadLimits.MaxFileBytes + 1];
        Photo.AsSpan(0, Photo.Length - 2).CopyTo(big);
        big[^2] = 0xFF;
        big[^1] = 0xD9;
        var added = await rig.AddAsync(UploadForm.Riders);

        using var svg = await rig.UploadAsync(UploadForm.Riders, SyntheticImages.Svg(), fileName: "Logo.jpg");
        using var tooLarge = await rig.UploadAsync(UploadForm.Riders, big, fileName: "Team shirt.jpg");
        using var tooBig = await rig.UploadAsync(UploadForm.Riders, SyntheticImages.Jpeg(6000, 5000), fileName: "Wide print.jpg");
        using var replaceSvg = await rig.ReplacePhotoAsync(added.Id, SyntheticImages.Svg(), fileName: "Logo.jpg");

        foreach (var (response, code, message) in new[]
        {
            (svg, "images.type", "Logo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
            (tooLarge, "images.too-large", "Team shirt.jpg is over 10 MB. Choose a smaller photo."),
            (tooBig, "images.too-big", "Wide print.jpg is too big. Photos can be at most 25 megapixels."),
            (replaceSvg, "images.type", "Logo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
        })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe(code);
            problem.GetProperty("errors").GetProperty("file").EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        }

        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).Count().ShouldBe(1);
        (await rig.ListAsync()).Rows.ShouldHaveSingleItem().Id.ShouldBe(added.Id);
    }

    [Fact]
    public async Task AnUploadOrAnEditRacingTheDeleteOfItsLineEndsAs200Or201With422OrAs400With204AndNeverAs500()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var existing = await rig.AddAsync(UploadForm.Riders);

        for (var round = 0; round < RaceRounds; round++)
        {
            var lineId = await rig.AddLineAsync($"Race {round}");
            var (uploaded, deleted) = await ConcurrentRequests.SendTogetherAsync(
                () => rig.UploadAsync(UploadForm.Riders with { LineId = lineId }, Photo),
                () => rig.DeleteLineAsync(lineId));
            using (uploaded)
            using (deleted)
            {
                (uploaded.StatusCode, deleted.StatusCode).ShouldBeOneOf(
                    (HttpStatusCode.Created, HttpStatusCode.UnprocessableEntity),
                    (HttpStatusCode.BadRequest, HttpStatusCode.NoContent));
            }

            await NoUploadPointsAtAMissingLineAsync(rig);
        }

        for (var round = 0; round < RaceRounds; round++)
        {
            var lineId = await rig.AddLineAsync($"Edit race {round}");
            var current = (await rig.ListAsync()).Rows.Single(row => row.Id == existing.Id);
            var (edited, deleted) = await ConcurrentRequests.SendTogetherAsync(
                () => rig.UpdateAsync(existing.Id, new { teamName = "Tondo Sample Riders", productLineId = lineId, pieces = 12, note = "Dri-fit mesh, V-neck", isShown = true, version = current.Version }),
                () => rig.DeleteLineAsync(lineId));
            using (deleted)
            using (edited)
            {
                (edited.StatusCode, deleted.StatusCode).ShouldBeOneOf(
                    (HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity),
                    (HttpStatusCode.BadRequest, HttpStatusCode.NoContent));
            }

            await NoUploadPointsAtAMissingLineAsync(rig);
            if (edited.StatusCode == HttpStatusCode.OK)
            {
                // Put the upload back on its first line so the next round can move it again.
                var back = (await rig.ListAsync()).Rows.Single(row => row.Id == existing.Id);
                using var restored = await rig.UpdateAsync(existing.Id, new { teamName = "Tondo Sample Riders", productLineId = GallerySeeding.LineId("moto"), pieces = 12, note = "Dri-fit mesh, V-neck", isShown = true, version = back.Version });
                restored.StatusCode.ShouldBe(HttpStatusCode.OK);
            }
        }
    }

    // The end state of a race: no upload names a line that is gone.
    private static async Task NoUploadPointsAtAMissingLineAsync(GalleryAdminRig rig)
    {
        await using var context = rig.Database.CreateContext();
        var orphans = await context.GalleryEntries
            .Where(entry => entry.ProductLineId != null && !context.ProductLines.Any(line => line.Id == entry.ProductLineId))
            .CountAsync(TestContext.Current.CancellationToken);
        orphans.ShouldBe(0);
    }

    [Fact]
    public async Task EveryGalleryWriteGivesANewPublicETagOnTheNextRead()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var etags = new List<string>();
        async Task Mark()
        {
            var (document, etag) = await rig.PublicGalleryAsync();
            document.Dispose();
            etags.Add(etag);
        }

        await Mark();
        var first = await rig.AddAsync(UploadForm.Riders with { Team = "First ETag Sample" });
        await Mark();
        using var edit = await rig.UpdateAsync(first.Id, new { teamName = "First ETag Sample MC", productLineId = GallerySeeding.LineId("moto"), pieces = 12, note = "Dri-fit mesh, V-neck", isShown = true, version = first.Version });
        await Mark();
        using var replace = await rig.ReplacePhotoAsync(first.Id, SyntheticImages.Jpeg(700, 700));
        await Mark();
        var second = await rig.AddAsync(UploadForm.Riders with { Team = "Second ETag Sample" });
        await Mark();
        using var move = await rig.MoveAsync(second.Id, "down");
        await Mark();
        using var hide = await rig.HideAsync(first.Id);
        await Mark();
        using var show = await rig.ShowAsync(first.Id);
        await Mark();
        using var delete = await rig.DeleteAsync(second.Id);
        await Mark();

        new[] { edit, replace, move, hide, show, delete }.ShouldAllBe(response => response.IsSuccessStatusCode);
        etags.Count.ShouldBe(9);
        etags.Zip(etags.Skip(1)).ShouldAllBe(pair => pair.First != pair.Second);
    }

    private static async Task<string> FieldMessageAsync(HttpResponseMessage response, string field)
    {
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        return problem.GetProperty("errors").GetProperty(field).EnumerateArray().Select(item => item.GetString()).ShouldHaveSingleItem()!;
    }

    private async Task<List<AuditEntry>> AuditAsync(GalleryAdminRig rig, string action)
    {
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.Action == action)
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheListPagesInGalleryOrderAndFiltersByLine()
    {
        await using var rig = await GalleryAdminRig.StartAsync(database);
        var first = await rig.AddAsync(UploadForm.Riders with { Team = "First Sample Team", LineId = GallerySeeding.LineId("moto") });
        var second = await rig.AddAsync(UploadForm.Riders with { Team = "Second Sample Team", LineId = GallerySeeding.LineId("basketball") });
        var third = await rig.AddAsync(UploadForm.Riders with { Team = "Third Sample Team", LineId = GallerySeeding.LineId("moto") });

        var pageOne = await rig.ListAsync("?page=1&pageSize=2");
        var pageTwo = await rig.ListAsync("?page=2&pageSize=2");
        var motoOnly = await rig.ListAsync($"?line={GallerySeeding.LineId("moto"):D}");
        var pastTheEnd = await rig.ListAsync("?page=9&pageSize=2");

        pageOne.Rows.Select(row => row.Id).ShouldBe([third.Id, second.Id]);
        (pageOne.Total, pageOne.Page, pageOne.Size).ShouldBe((3, 1, 2));
        pageTwo.Rows.Select(row => row.Id).ShouldBe([first.Id]);
        motoOnly.Rows.Select(row => row.Id).ShouldBe([third.Id, first.Id]);
        motoOnly.Total.ShouldBe(2);
        pastTheEnd.Rows.ShouldBeEmpty();
        pastTheEnd.Total.ShouldBe(3);

        foreach (var bad in new[] { "?page=0", "?pageSize=0", "?pageSize=101", "?line=not-an-id" })
        {
            using var response = await rig.GetListAsync(bad);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, bad);
        }
    }
}
