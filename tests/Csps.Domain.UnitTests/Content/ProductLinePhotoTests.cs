using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-02: a line photo is built from the facts of a stored file, and a replace puts a new file in its place and hands back the old id.</summary>
public sealed class ProductLinePhotoTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void APhotoIsBuiltFromTheFactsOfAStoredFile()
    {
        var lineId = Guid.CreateVersion7(Now);

        var photo = ProductLinePhoto.Create(lineId, ProductLinePhotoSlot.Main, new LinePhotoFile("csps/content/lines/a/b", 800, 600, 4321, "png"), Now);

        (photo.LineId, photo.Slot, photo.PublicId, photo.Width, photo.Height, photo.Bytes, photo.Format).ShouldBe((lineId, ProductLinePhotoSlot.Main, "csps/content/lines/a/b", 800, 600, 4321, "png"));
        photo.CreatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public void AReplaceKeepsTheRowItsPlaceAndItsIdAndReturnsTheOldPublicId()
    {
        var photo = ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Back, new LinePhotoFile("old-id", 100, 100, 10, "jpg"), Now);
        var id = photo.Id;
        var lineId = photo.LineId;

        var old = photo.Replace(new LinePhotoFile("new-id", 640, 480, 2000, "webp"));

        old.ShouldBe("old-id");
        (photo.PublicId, photo.Width, photo.Height, photo.Bytes, photo.Format).ShouldBe(("new-id", 640, 480, 2000, "webp"));
        (photo.Id, photo.LineId, photo.Slot).ShouldBe((id, lineId, ProductLinePhotoSlot.Back));
    }

    [Fact]
    public void ANewFileIsRequired()
    {
        var photo = ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, new LinePhotoFile("id", 1, 1, 1, "jpg"), Now);

        Should.Throw<ArgumentNullException>(() => ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, null!, Now));
        Should.Throw<ArgumentNullException>(() => photo.Replace(null!));
    }
}
