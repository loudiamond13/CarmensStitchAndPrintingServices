using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-01, D-02, D-06: a line built from the seed carries every seeded value, a reset puts them all back, and a photo row keeps its slot and file facts.</summary>
public sealed class ProductLineTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 3, 0, 0, TimeSpan.Zero);

    private static readonly ProductLineSeedEntry Basketball = ProductLineSeed.All[0];

    [Fact]
    public void FromSeedCopiesEveryValueAndTheStamp()
    {
        var line = ProductLine.FromSeed(Basketball, 650.00m, 10, Now);

        line.Id.ShouldBe(Basketball.Id);
        line.Key.ShouldBe(Basketball.Key);
        line.Title.ShouldBe(Basketball.Title);
        line.ShortName.ShouldBe(Basketball.ShortName);
        line.Number.ShouldBe(Basketball.Number);
        line.CardText.ShouldBe(Basketball.CardText);
        line.Description.ShouldBe(Basketball.Description);
        line.FabricText.ShouldBe(Basketball.FabricText);
        line.CollarText.ShouldBe(Basketball.CollarText);
        line.CutText.ShouldBe(Basketball.CutText);
        line.NamesText.ShouldBe(Basketball.NamesText);
        line.LogosText.ShouldBe(Basketball.LogosText);
        line.StartsAtPrice.ShouldBe(650.00m);
        line.MinimumQuantity.ShouldBe(10);
        line.Position.ShouldBe(Basketball.Position);
        line.IsActive.ShouldBeTrue();
        line.PlaceholderArt.ShouldBe(PlaceholderArt.Basketball);
        line.CreatedAtUtc.ShouldBe(Now);
        line.UpdatedAtUtc.ShouldBeNull();
        line.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void ResetToSeedPutsEveryValueBack()
    {
        var other = ProductLineSeed.All[1];
        var line = ProductLine.FromSeed(other, 1m, 99, Now);

        line.ResetToSeed(Basketball, null, null);

        line.Key.ShouldBe(Basketball.Key);
        line.Title.ShouldBe(Basketball.Title);
        line.ShortName.ShouldBe(Basketball.ShortName);
        line.Number.ShouldBe(Basketball.Number);
        line.CardText.ShouldBe(Basketball.CardText);
        line.Description.ShouldBe(Basketball.Description);
        line.FabricText.ShouldBe(Basketball.FabricText);
        line.CollarText.ShouldBe(Basketball.CollarText);
        line.CutText.ShouldBe(Basketball.CutText);
        line.NamesText.ShouldBe(Basketball.NamesText);
        line.LogosText.ShouldBe(Basketball.LogosText);
        line.StartsAtPrice.ShouldBeNull();
        line.MinimumQuantity.ShouldBeNull();
        line.Position.ShouldBe(Basketball.Position);
        line.PlaceholderArt.ShouldBe(PlaceholderArt.Basketball);
    }

    [Fact]
    public void FromSeedAndResetToSeedRejectANullEntry()
    {
        Should.Throw<ArgumentNullException>(() => ProductLine.FromSeed(null!, null, null, Now));
        Should.Throw<ArgumentNullException>(() => ProductLine.FromSeed(Basketball, null, null, Now).ResetToSeed(null!, null, null));
    }

    [Fact]
    public void APhotoKeepsItsSlotAndFileFacts()
    {
        var lineId = Guid.CreateVersion7(Now);

        var photo = ProductLinePhoto.Create(lineId, ProductLinePhotoSlot.Back, "csps/lines/abc", 1200, 900, 345_678, "webp", Now);

        photo.Id.ShouldNotBe(Guid.Empty);
        photo.LineId.ShouldBe(lineId);
        photo.Slot.ShouldBe(ProductLinePhotoSlot.Back);
        photo.PublicId.ShouldBe("csps/lines/abc");
        photo.Width.ShouldBe(1200);
        photo.Height.ShouldBe(900);
        photo.Bytes.ShouldBe(345_678);
        photo.Format.ShouldBe("webp");
        photo.CreatedAtUtc.ShouldBe(Now);
        photo.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void APhotoNeedsAFileIdAndAFormat()
    {
        Should.Throw<ArgumentNullException>(() => ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, null!, 1, 1, 1, "jpg", Now));
        Should.Throw<ArgumentNullException>(() => ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, "id", 1, 1, 1, null!, Now));
    }
}
