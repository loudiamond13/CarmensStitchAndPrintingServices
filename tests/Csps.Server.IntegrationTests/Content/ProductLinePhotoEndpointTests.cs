using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-02, D-26, PUB-02, PUB-04, IMG-03, T-11-46, T-11-48: a Manager adds a photo to one of the three slots of a product line through the
/// server. The file is checked and stored under a random id in the content folder, never the orders folder, and the public product
/// lines read shows its addresses with a new ETag.
/// </summary>
public sealed class ProductLinePhotoEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid Basketball = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task AManagerUploadsAMainPhotoUnderTheContentFolderAndThePublicDataShowsItWithANewETag()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        var (before, etagBefore) = await rig.PublicLinesAsync();
        before.Dispose();

        using var response = await rig.UploadPhotoAsync(Basketball, "main", Photo);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var answer = JsonDocument.Parse(text);
        answer.RootElement.GetProperty("slot").GetString().ShouldBe("main");
        answer.RootElement.GetProperty("width").GetInt32().ShouldBe(640);
        answer.RootElement.GetProperty("height").GetInt32().ShouldBe(480);

        var upload = storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/content/lines/{Basketball:D}").ShouldHaveSingleItem();
        Regex.IsMatch(upload.PublicId, $"^csps-test/content/lines/{Basketball:D}/[a-z2-7]{{26}}$").ShouldBeTrue(upload.PublicId);
        upload.PublicId.ShouldNotContain("/orders/");

        await using var context = database.CreateContext();
        var row = await context.ProductLinePhotos.AsNoTracking().SingleAsync(photo => photo.LineId == Basketball, TestContext.Current.CancellationToken);
        row.Slot.ShouldBe(ProductLinePhotoSlot.Main);
        row.PublicId.ShouldBe(upload.PublicId);
        (row.Width, row.Height, row.Bytes, row.Format).ShouldBe((640, 480, Photo.Length, "jpg"));

        var (after, etagAfter) = await rig.PublicLinesAsync();
        using (after)
        {
            etagAfter.ShouldNotBe(etagBefore);
            var main = after.RootElement.GetProperty("lines").EnumerateArray().First(line => line.GetProperty("key").GetString() == "basketball")
                .GetProperty("photos").GetProperty("main");
            main.GetProperty("src").GetString().ShouldNotBeNullOrWhiteSpace();
            main.GetProperty("srcSet").GetString().ShouldNotBeNullOrWhiteSpace();
            (main.GetProperty("width").GetInt32(), main.GetProperty("height").GetInt32()).ShouldBe((640, 480));
            var back = after.RootElement.GetProperty("lines").EnumerateArray().First(line => line.GetProperty("key").GetString() == "basketball")
                .GetProperty("photos").GetProperty("back");
            back.ValueKind.ShouldBe(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task AnAdminGets403AndNothingIsStored()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await rig.UploadPhotoAsync(Basketball, "main", Photo, admin);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.ProductLinePhotos.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ReplacingAPhotoKeepsOneRowQueuesTheOldFileOnceAndWritesTheAuditEntryWithoutTheAddress()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        using var first = await rig.UploadPhotoAsync(Basketball, "back", Photo);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var oldId = await StoredIdAsync("back");

        using var second = await rig.UploadPhotoAsync(Basketball, "back", SyntheticImages.Jpeg(800, 800));
        second.StatusCode.ShouldBe(HttpStatusCode.OK, await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        var newId = await StoredIdAsync("back");
        newId.ShouldNotBe(oldId);
        await using var context = database.CreateContext();
        (await context.ProductLinePhotos.AsNoTracking().CountAsync(photo => photo.LineId == Basketball, TestContext.Current.CancellationToken)).ShouldBe(1);
        var queued = await context.Set<ImageDeletion>().AsNoTracking().Where(row => row.PublicId == oldId).ToListAsync(TestContext.Current.CancellationToken);
        queued.ShouldHaveSingleItem().Reason.ShouldBe(ImageDeletionReason.PhotoReplaced);
        (await context.Set<ImageDeletion>().AsNoTracking().CountAsync(row => row.PublicId == newId, TestContext.Current.CancellationToken)).ShouldBe(0);

        var entries = await PhotoAuditAsync(context, rig);
        entries.Select(row => row.Detail).ShouldBe(["key=basketball;title=Basketball Jerseys;slot=back;change=added", "key=basketball;title=Basketball Jerseys;slot=back;change=replaced"]);
        entries.ShouldAllBe(row => row.TargetType == "ProductLine" && row.TargetId == Basketball.ToString("D"));
        entries.ShouldAllBe(row => !row.Detail!.Contains(oldId, StringComparison.Ordinal) && !row.Detail.Contains(newId, StringComparison.Ordinal));
    }

    [Fact]
    public async Task RemovingTheMainPhotoAnswers204QueuesTheFileAuditsItAndThePublicReadShowsNull()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        using var uploaded = await rig.UploadPhotoAsync(Basketball, "main", Photo);
        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);
        var storedId = await StoredIdAsync("main");
        var (before, etagBefore) = await rig.PublicLinesAsync();
        before.Dispose();

        using var removed = await rig.RemovePhotoAsync(Basketball, "main");

        removed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.ProductLinePhotos.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.Set<ImageDeletion>().AsNoTracking().SingleAsync(row => row.PublicId == storedId, TestContext.Current.CancellationToken)).Reason.ShouldBe(ImageDeletionReason.PhotoDeleted);
        var (after, etagAfter) = await rig.PublicLinesAsync();
        using (after)
        {
            etagAfter.ShouldNotBe(etagBefore);
            after.RootElement.GetProperty("lines").EnumerateArray().First(line => line.GetProperty("key").GetString() == "basketball")
                .GetProperty("photos").GetProperty("main").ValueKind.ShouldBe(JsonValueKind.Null);
        }

        (await PhotoAuditAsync(context, rig)).Select(row => row.Detail).ShouldBe(
            ["key=basketball;title=Basketball Jerseys;slot=main;change=added", "key=basketball;title=Basketball Jerseys;slot=main;change=removed"]);
    }

    [Fact]
    public async Task RemovingFromAnEmptySlotAnUnknownSlotOrAMissingLineAnswers404AndWritesNothing()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var empty = await rig.RemovePhotoAsync(Basketball, "fabric");
        using var unknownSlot = await rig.RemovePhotoAsync(Basketball, "front");
        using var unknownLine = await rig.RemovePhotoAsync(Guid.NewGuid(), "main");
        using var uploadUnknownSlot = await rig.UploadPhotoAsync(Basketball, "front", Photo);
        using var uploadUnknownLine = await rig.UploadPhotoAsync(Guid.NewGuid(), "main", Photo);

        new[] { empty, unknownSlot, unknownLine, uploadUnknownSlot, uploadUnknownLine }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.NotFound);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await PhotoAuditAsync(context, rig)).ShouldBeEmpty();
        (await context.Set<ImageDeletion>().AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnSvgNamedAsAJpegIsRefusedByItsBytesWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.UploadPhotoAsync(Basketball, "main", SyntheticImages.Svg(), fileName: "Logo.jpg");

        await ExpectRefusedAsync(rig, response, "images.type", "Logo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    }

    [Fact]
    public async Task AFileOneByteOverTenMegabytesIsRefusedWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var big = new byte[Csps.Application.Images.ImageUploadLimits.MaxFileBytes + 1];
        Photo.AsSpan(0, Photo.Length - 2).CopyTo(big);
        big[^2] = 0xFF;
        big[^1] = 0xD9;

        using var response = await rig.UploadPhotoAsync(Basketball, "main", big, fileName: "Team shirt.jpg");

        await ExpectRefusedAsync(rig, response, "images.too-large", "Team shirt.jpg is over 10 MB. Choose a smaller photo.");
    }

    [Fact]
    public async Task APhotoWithTooManyPixelsIsRefusedWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.UploadPhotoAsync(Basketball, "main", SyntheticImages.Jpeg(6000, 5000), fileName: "Wide print.jpg");

        await ExpectRefusedAsync(rig, response, "images.too-big", "Wide print.jpg is too big. Photos can be at most 25 megapixels.");
    }

    [Fact]
    public async Task ALineWithAPhotoCannotBeDeletedAndAnUploadRacingTheDeleteNeverAnswers500()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        using var withPhoto = await rig.UploadPhotoAsync(Basketball, "main", Photo);
        withPhoto.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var blocked = await rig.DeleteAsync(Basketball);
        blocked.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(blocked, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("product-lines.in-use");

        for (var round = 0; round < 6; round++)
        {
            var line = await rig.AddAsync(LineBody.Shorts with { Title = $"Race {round}", ShortName = $"Race {round}" });
            var upload = Task.Run(() => rig.UploadPhotoAsync(line.Id, "main", Photo), TestContext.Current.CancellationToken);
            var delete = Task.Run(() => rig.DeleteAsync(line.Id), TestContext.Current.CancellationToken);
            using var uploaded = await upload;
            using var deleted = await delete;

            (uploaded.StatusCode, deleted.StatusCode).ShouldBeOneOf(
                (HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity),
                (HttpStatusCode.NotFound, HttpStatusCode.NoContent));
        }
    }

    private async Task<string> StoredIdAsync(string slot)
    {
        var wanted = slot switch { "main" => ProductLinePhotoSlot.Main, "back" => ProductLinePhotoSlot.Back, _ => ProductLinePhotoSlot.Fabric };
        await using var context = database.CreateContext();
        return await context.ProductLinePhotos.AsNoTracking().Where(photo => photo.LineId == Basketball && photo.Slot == wanted).Select(photo => photo.PublicId).SingleAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<List<AuditEntry>> PhotoAuditAsync(CspsDbContext context, ProductLineRig rig) =>
        await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.Action == "product-line.photo-changed")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

    private async Task ExpectRefusedAsync(ProductLineRig rig, HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("errors").GetProperty("file").EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        rig.Factory.Services.GetRequiredService<TestingImageStorage>().Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.ProductLinePhotos.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }
}
