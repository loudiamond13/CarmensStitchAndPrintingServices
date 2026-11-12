using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-03, D-08: a line knows whether the Gallery has a public item under it (hasGalleryItems on the public read), the Manager's list counts
/// the public items of each line, and a line with a gallery entry cannot be deleted.
/// </summary>
public sealed class PublicGalleryLineFlagsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task HasGalleryItemsIsTrueOnlyForALineWithAPublicItem()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", Now);
        await GallerySeeding.AddOrdersAsync(
            database,
            [
                new SeedGalleryOrder("Shown basketball") { LineKey = "basketball", Position = 1 },
                new SeedGalleryOrder("Not shown volleyball") { LineKey = "volleyball", Show = false, Position = 2 },
                new SeedGalleryOrder("Deleted moto") { LineKey = "moto", Deleted = true, Position = 3 },
            ],
            staff,
            Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Upload on polo", "polo") { Position = 4 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Hidden upload on custom", "custom") { Shown = false, Position = 5 }, Now);

        var (document, _) = await rig.ReadAsync("/api/v1/public/product-lines");

        using (document)
        {
            var flags = document.RootElement.GetProperty("lines").EnumerateArray()
                .ToDictionary(line => line.GetProperty("key").GetString()!, line => line.GetProperty("hasGalleryItems").GetBoolean());
            flags.ShouldBe(new Dictionary<string, bool>
            {
                ["basketball"] = true,
                ["volleyball"] = false,
                ["moto"] = false,
                ["longsleeves"] = false,
                ["polo"] = true,
                ["custom"] = false,
            });
        }
    }

    [Fact]
    public async Task TheManagersListCountsThePublicItemsOfEachLine()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", Now);
        await GallerySeeding.AddOrdersAsync(
            database,
            [
                new SeedGalleryOrder("Basketball one") { LineKey = "basketball", Position = 1 },
                new SeedGalleryOrder("Basketball two") { LineKey = "basketball", Position = 2 },
                new SeedGalleryOrder("Not shown") { LineKey = "volleyball", Show = false, Position = 3 },
            ],
            staff,
            Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Volleyball upload", "volleyball") { Position = 4 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Custom upload", "custom") { Position = 5 }, Now);

        var counts = (await rig.ListLinesAsync()).ToDictionary(line => line.Key, line => line.ShownGalleryCount);

        counts["basketball"].ShouldBe(2);
        counts["volleyball"].ShouldBe(1);
        counts["custom"].ShouldBe(1);
        counts["moto"].ShouldBe(0);
    }

    [Fact]
    public async Task ALineWithAGalleryEntryCannotBeDeletedAndAnswers422AndNothingIsLost()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Custom upload", "custom") { Position = 1 }, Now);
        var custom = PublicGalleryRig.LineId("custom");

        var listed = (await rig.ListLinesAsync()).Single(line => line.Id == custom);
        using var response = await rig.DeleteLineAsync(custom);

        listed.CanDelete.ShouldBeFalse("a line with a gallery entry is offered Hide, not Delete");
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        problem.RootElement.GetProperty("code").GetString().ShouldBe("product-lines.in-use");
        (await rig.ListLinesAsync()).ShouldContain(line => line.Id == custom);
    }

    [Fact]
    public async Task ALineThatAnOrderWasFiledUnderByChoiceCannotBeDeletedEvenWhenTheOrderIsNotShown()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", Now);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Chose custom") { Unfiled = true, LineOverrideKey = "custom", Show = false }], staff, Now);
        var custom = PublicGalleryRig.LineId("custom");

        var listed = (await rig.ListLinesAsync()).Single(line => line.Id == custom);
        using var response = await rig.DeleteLineAsync(custom);

        listed.ShownGalleryCount.ShouldBe(0);
        listed.CanDelete.ShouldBeFalse();
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
    }
}
