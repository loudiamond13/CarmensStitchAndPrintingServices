using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
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
