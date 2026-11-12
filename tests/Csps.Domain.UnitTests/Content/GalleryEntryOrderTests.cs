using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-10, D-14: a shown order gets a gallery entry that holds only the order, at the place given, and carries none of the upload fields.</summary>
public sealed class GalleryEntryOrderTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AnOrderEntryHoldsTheOrderThePlaceAndTheShownFlagOnly()
    {
        var orderId = Guid.Parse("a5e3b9c1-0d74-4e28-8f16-3c2a7d5b9e40");

        var entry = GalleryEntry.ForOrder(orderId, -4, Now);

        entry.Kind.ShouldBe(GalleryEntryKind.Order);
        entry.OrderId.ShouldBe(orderId);
        entry.Position.ShouldBe(-4);
        entry.IsShown.ShouldBeTrue();
        entry.CreatedAtUtc.ShouldBe(Now);
        entry.Id.ShouldNotBe(Guid.Empty);
        entry.RowVersion.ShouldBeEmpty();
        entry.PublicId.ShouldBeNull();
        entry.Width.ShouldBeNull();
        entry.Height.ShouldBeNull();
        entry.Bytes.ShouldBeNull();
        entry.Format.ShouldBeNull();
        entry.TeamName.ShouldBeNull();
        entry.ProductLineId.ShouldBeNull();
        entry.Pieces.ShouldBeNull();
        entry.Note.ShouldBeNull();
        entry.CreatedById.ShouldBeNull();
        entry.UpdatedById.ShouldBeNull();
        entry.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void TheLimitsMatchTheUploadRules()
    {
        GalleryEntry.TeamNameMaxLength.ShouldBe(80);
        GalleryEntry.NoteMaxLength.ShouldBe(120);
        GalleryEntry.MinPieces.ShouldBe(1);
        GalleryEntry.MaxPieces.ShouldBe(9999);
    }
}
