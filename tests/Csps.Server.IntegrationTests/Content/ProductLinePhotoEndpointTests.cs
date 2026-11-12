using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Infrastructure.Images;
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
}
