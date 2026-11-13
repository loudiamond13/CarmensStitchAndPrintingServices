using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-26, PUB-04, AUDIT-01, IMG-03, T-11-76, T-11-77: a Manager sets the default link preview picture through the server. The file is
/// checked and stored under a new random id in the share folder of the content area, the file it replaces is queued for removal, and the
/// server HTML of the pages that have no picture of their own carries the picture at once. Each change is audited without the address.
/// </summary>
public sealed class SharePictureEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly byte[] Photo = SyntheticImages.Jpeg(1200, 630);

    [Fact]
    public async Task AManagerUploadsAJpegUnderTheShareFolderAndTheAnswerHoldsTheTwoPreviewAddresses()
    {
        await using var rig = await SharePictureRig.StartAsync(database);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await rig.UploadAsync(Photo);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var answer = JsonDocument.Parse(text);
        answer.RootElement.GetProperty("src320").GetString().ShouldEndWith("size=csps_share_320");
        answer.RootElement.GetProperty("src640").GetString().ShouldEndWith("size=csps_share_640");
        (answer.RootElement.GetProperty("width").GetInt32(), answer.RootElement.GetProperty("height").GetInt32()).ShouldBe((1200, 630));

        var upload = storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).ShouldHaveSingleItem();
        Regex.IsMatch(upload.PublicId, "^csps-test/content/share/00000000-0000-0000-0000-000000000001/[a-z2-7]{26}$").ShouldBeTrue(upload.PublicId);
        upload.PublicId.ShouldNotContain("/orders/");
    }

    [Fact]
    public async Task AnAdminGets403AndNothingIsStored()
    {
        await using var rig = await SharePictureRig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await rig.UploadAsync(Photo, admin);
        using var removal = await rig.RemoveAsync(admin);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        removal.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task EveryNewPictureGetsANewIdTheOldFileIsQueuedOnceAndEachChangeIsAuditedWithoutTheAddress()
    {
        await using var rig = await SharePictureRig.StartAsync(database);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        using var first = await rig.UploadAsync(Photo);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var oldId = storage.Uploads.Single(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).PublicId;

        using var second = await rig.UploadAsync(SyntheticImages.Jpeg(1600, 840));
        second.StatusCode.ShouldBe(HttpStatusCode.OK, await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        var newId = storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).Select(recorded => recorded.PublicId).Single(id => id != oldId);
        await using var context = database.CreateContext();
        var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.SharePicturePublicId.ShouldBe(newId);
        (row.SharePictureWidth, row.SharePictureHeight, row.SharePictureFormat).ShouldBe((1600, 840, "jpg"));
        (await context.Set<ImageDeletion>().AsNoTracking().SingleAsync(item => item.PublicId == oldId, TestContext.Current.CancellationToken)).Reason.ShouldBe(ImageDeletionReason.PhotoReplaced);
        (await context.Set<ImageDeletion>().AsNoTracking().CountAsync(item => item.PublicId == newId, TestContext.Current.CancellationToken)).ShouldBe(0);

        var entries = await ShareAuditAsync(context, rig);
        entries.Select(entry => entry.Detail).ShouldBe(["change=added", "change=replaced"]);
        entries.ShouldAllBe(entry => entry.TargetType == "SiteSettings" && entry.TargetId == "1");
        entries.ShouldAllBe(entry => !entry.Detail!.Contains(oldId, StringComparison.Ordinal) && !entry.Detail.Contains(newId, StringComparison.Ordinal));
    }

    [Fact]
    public async Task RemovingAnswers204QueuesTheFileAuditsItAndTheNextHomeHasNoPictureAndTheSmallCard()
    {
        await using var rig = await SharePictureRig.StartAsync(database);
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        using var uploaded = await rig.UploadAsync(Photo);
        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);
        var storedId = storage.Uploads.Single(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).PublicId;
        var before = await rig.PageAsync("/");

        using var removed = await rig.RemoveAsync();
        var after = await rig.PageAsync("/");
        using var again = await rig.RemoveAsync();

        before.ShouldContain("property=\"og:image\"");
        removed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        after.ShouldNotContain("og:image");
        after.ShouldContain("name=\"twitter:card\" content=\"summary\"");
        again.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(again, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("site-settings.share-picture-not-found");

        await using var context = database.CreateContext();
        var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        (row.SharePicturePublicId, row.SharePictureWidth, row.SharePictureHeight, row.SharePictureBytes, row.SharePictureFormat).ShouldBe((null, null, null, null, null));
        (await context.Set<ImageDeletion>().AsNoTracking().SingleAsync(item => item.PublicId == storedId, TestContext.Current.CancellationToken)).Reason.ShouldBe(ImageDeletionReason.PhotoDeleted);
        (await ShareAuditAsync(context, rig)).Select(entry => entry.Detail).ShouldBe(["change=added", "change=removed"]);
    }

    [Fact]
    public async Task AnSvgNamedAsAJpegIsRefusedByItsBytesWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await SharePictureRig.StartAsync(database);

        using var response = await rig.UploadAsync(SyntheticImages.Svg(), fileName: "Logo.jpg");

        await ExpectRefusedAsync(rig, response, "images.type", "Logo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    }

    [Fact]
    public async Task AFileOneByteOverTenMegabytesIsRefusedWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await SharePictureRig.StartAsync(database);
        var big = new byte[Csps.Application.Images.ImageUploadLimits.MaxFileBytes + 1];
        Photo.AsSpan(0, Photo.Length - 2).CopyTo(big);
        big[^2] = 0xFF;
        big[^1] = 0xD9;

        using var response = await rig.UploadAsync(big, fileName: "Team shirt.jpg");

        await ExpectRefusedAsync(rig, response, "images.too-large", "Team shirt.jpg is over 10 MB. Choose a smaller photo.");
    }

    [Fact]
    public async Task APhotoWithTooManyPixelsIsRefusedWithTheP9MessageAndNothingIsStored()
    {
        await using var rig = await SharePictureRig.StartAsync(database);

        using var response = await rig.UploadAsync(SyntheticImages.Jpeg(6000, 5000), fileName: "Wide print.jpg");

        await ExpectRefusedAsync(rig, response, "images.too-big", "Wide print.jpg is too big. Photos can be at most 25 megapixels.");
    }

    private static async Task<List<AuditEntry>> ShareAuditAsync(CspsDbContext context, SharePictureRig rig) =>
        await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.Action == "site-settings.share-picture-changed")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

    private async Task ExpectRefusedAsync(SharePictureRig rig, HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("errors").GetProperty("file").EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        rig.Factory.Services.GetRequiredService<TestingImageStorage>().Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).SharePicturePublicId.ShouldBeNull();
        (await ShareAuditAsync(context, rig)).ShouldBeEmpty();
    }
}
