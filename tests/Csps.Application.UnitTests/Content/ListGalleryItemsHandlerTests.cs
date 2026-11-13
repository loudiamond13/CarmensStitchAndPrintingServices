using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>GAL-03: the gallery list checks its query first, passes the line filter and page to the store, and maps each row with its thumb address.</summary>
public sealed class ListGalleryItemsHandlerTests
{
    private static readonly Guid LineId = Guid.Parse("b3d5f7a9-1c2e-4a60-8b94-5d7e9f1a3c20");

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static GalleryItemRow Upload(Guid id, string? photo = "csps-test/p") =>
        new(id, GalleryEntryKind.Upload, 1, "Tondo Sample Riders", LineId, "Moto", true, 12, false, null, null, "Dri-fit", photo, photo is null ? null : 800, photo is null ? null : 600, [1, 2, 3, 4, 5, 6, 7, 8]);

    private static GalleryItemRow Order(Guid id) =>
        new(id, GalleryEntryKind.Order, 2, "Brgy. Sample Ballers", LineId, "Moto", false, 17, true, Guid.NewGuid(), "ORD-2026-0001", null, "csps-test/o", 800, 600, []);

    private static ListGalleryItemsHandler HandlerFor(IGalleryEntries entries, string thumb = "https://images.example.test/t")
    {
        var delivery = Substitute.For<IImageDelivery>();
        var source = new Csps.Application.Images.ImageSource("a", "a 1w");
        delivery.ForGallery(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new Csps.Application.Images.GalleryPhotoUrls(source, source, thumb));
        return new ListGalleryItemsHandler(entries, delivery, new ListGalleryItemsRequestValidator());
    }

    [Fact]
    public async Task AValidQueryReadsThePageForTheLineAndMapsEveryRow()
    {
        var entries = Substitute.For<IGalleryEntries>();
        var upload = Guid.NewGuid();
        var order = Guid.NewGuid();
        entries.ListAsync(LineId, 2, 50, Arg.Any<CancellationToken>()).Returns(new GalleryItemPage([Upload(upload), Order(order)], 77));

        var result = await HandlerFor(entries).HandleAsync(new ListGalleryItemsRequest($" {LineId:D} ", 2, 50), Token);

        result.IsSuccess.ShouldBeTrue();
        (result.Value.Total, result.Value.Page, result.Value.Size).ShouldBe((77, 2, 50));
        var rows = result.Value.Rows;
        (rows[0].Kind, rows[0].Name, rows[0].Version, rows[0].Note, rows[0].Thumb, rows[0].IsShown, rows[0].OrderNumber).ShouldBe(("upload", "Tondo Sample Riders", "AQIDBAUGBwg=", "Dri-fit", "https://images.example.test/t", false, null));
        (rows[1].Kind, rows[1].Version, rows[1].OrderNumber, rows[1].LineHidden, rows[1].Pieces).ShouldBe(("order", null, "ORD-2026-0001", false, 17));
    }

    [Fact]
    public async Task NoLineMeansEveryLineAndARowWithNoPhotoOrNoAddressHasNoThumb()
    {
        var entries = Substitute.For<IGalleryEntries>();
        entries.ListAsync(null, 1, 20, Arg.Any<CancellationToken>()).Returns(new GalleryItemPage([Upload(Guid.NewGuid(), photo: null), Upload(Guid.NewGuid())], 2));

        var result = await HandlerFor(entries, thumb: string.Empty).HandleAsync(new ListGalleryItemsRequest(), Token);

        result.Value.Rows.Select(row => row.Thumb).ShouldBe([null, null]);
    }

    [Theory]
    [InlineData("not-an-id", 1, 20)]
    [InlineData("00000000-0000-0000-0000-000000000000", 1, 20)]
    [InlineData(null, 0, 20)]
    [InlineData(null, 100001, 20)]
    [InlineData(null, 1, 0)]
    [InlineData(null, 1, 101)]
    public async Task ABadLinePageOrSizeIsA400AndTheStoreIsNeverCalled(string? line, int page, int size)
    {
        var entries = Substitute.For<IGalleryEntries>();

        var result = await HandlerFor(entries).HandleAsync(new ListGalleryItemsRequest(line, page, size), Token);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        await entries.DidNotReceiveWithAnyArgs().ListAsync(default, default, default, Token);
    }
}
