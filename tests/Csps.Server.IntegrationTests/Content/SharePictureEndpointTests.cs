using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-26, PUB-04, IMG-03, T-11-76, T-11-77: a Manager sets the default link preview picture through the server. The file is checked and
/// stored under a random id in the share folder of the content area, and the server HTML of the pages that have no picture of their own
/// carries it as <c>og:image</c> at once.
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

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains("/content/", StringComparison.Ordinal)).ShouldBeEmpty();
    }
}
