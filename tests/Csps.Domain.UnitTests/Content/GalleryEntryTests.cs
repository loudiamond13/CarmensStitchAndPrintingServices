using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>GAL-03, D-10: a direct upload holds its photo, team, line, pieces and note, is checked against the UI-SPEC rules and joins the gallery where it is told.</summary>
public sealed class GalleryEntryTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid Moto = Guid.Parse("b3d5f7a9-1c2e-4a60-8b94-5d7e9f1a3c20");
    private static readonly LinePhotoFile File = new("csps/content/gallery/abc/def", 800, 600, 12345, "jpg");

    private static GalleryUploadValues Valid { get; } = new("Tondo Sample Riders", Moto, 12m, "Dri-fit mesh, V-neck", true);

    [Fact]
    public void AnUploadHoldsItsPhotoAndTheTypedValuesAtTheGivenPlace()
    {
        var id = GalleryEntry.NewId(Now);

        var entry = GalleryEntry.CreateUpload(id, Valid, File, -3, Now).Value;

        entry.Id.ShouldBe(id);
        entry.Kind.ShouldBe(GalleryEntryKind.Upload);
        entry.OrderId.ShouldBeNull();
        entry.Position.ShouldBe(-3);
        (entry.PublicId, entry.Width, entry.Height, entry.Bytes, entry.Format).ShouldBe(("csps/content/gallery/abc/def", 800, 600, 12345, "jpg"));
        (entry.TeamName, entry.ProductLineId, entry.Pieces, entry.Note, entry.IsShown).ShouldBe(("Tondo Sample Riders", Moto, 12, "Dri-fit mesh, V-neck", true));
        entry.CreatedAtUtc.ShouldBe(Now);
        entry.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void ATeamAndANoteAreTrimmedAndAnEmptyNoteAndNoPiecesAreKeptAsNone()
    {
        var entry = GalleryEntry.CreateUpload(GalleryEntry.NewId(Now), new GalleryUploadValues("  Tondo Sample Riders  ", Moto, null, "   ", null), File, 0, Now).Value;

        entry.TeamName.ShouldBe("Tondo Sample Riders");
        entry.Note.ShouldBeNull();
        entry.Pieces.ShouldBeNull();
        entry.IsShown.ShouldBeFalse();
    }

    [Fact]
    public void ANoteIsTrimmed()
    {
        var entry = GalleryEntry.CreateUpload(GalleryEntry.NewId(Now), Valid with { Note = "  V-neck  " }, File, 0, Now).Value;

        entry.Note.ShouldBe("V-neck");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ATeamIsRequired(string? team)
    {
        var errors = GalleryEntry.Check(Valid with { TeamName = team });

        errors["teamName"].ShouldBe(["Enter the team or name."]);
        errors.Count.ShouldBe(1);
    }

    [Fact]
    public void ATeamOfEightyCharactersIsFineAndEightyOneIsTooLong()
    {
        GalleryEntry.Check(Valid with { TeamName = new string('a', 80) }).ShouldBeEmpty();
        GalleryEntry.Check(Valid with { TeamName = $" {new string('a', 81)} " })["teamName"].ShouldBe(["Keep this to 80 characters or fewer."]);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(9999)]
    public void PiecesFromOneToNineThousandNineHundredNinetyNineAreFine(int pieces)
    {
        GalleryEntry.Check(Valid with { Pieces = pieces }).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    [InlineData(10000)]
    [InlineData(2.5)]
    public void PiecesOutsideTheRangeOrFractionalAreRefused(double pieces)
    {
        GalleryEntry.Check(Valid with { Pieces = (decimal)pieces })["pieces"].ShouldBe(["Enter a whole number from 1 to 9,999."]);
    }

    [Fact]
    public void ANoteOfOneHundredTwentyCharactersIsFineAndOneHundredTwentyOneIsTooLong()
    {
        GalleryEntry.Check(Valid with { Note = new string('n', 120) }).ShouldBeEmpty();
        GalleryEntry.Check(Valid with { Note = $" {new string('n', 121)} " })["note"].ShouldBe(["Keep the note to 120 characters or fewer."]);
        GalleryEntry.Check(Valid with { Note = null }).ShouldBeEmpty();
    }

    [Fact]
    public void ALineIsRequired()
    {
        GalleryEntry.Check(Valid with { ProductLineId = null })["productLineId"].ShouldBe(["Choose the product line."]);
        GalleryEntry.Check(Valid with { ProductLineId = Guid.Empty })["productLineId"].ShouldBe(["Choose the product line."]);
    }

    [Fact]
    public void ABrokenFormGivesAValidationErrorNamingEveryField()
    {
        var failed = GalleryEntry.CreateUpload(GalleryEntry.NewId(Now), new GalleryUploadValues(null, null, null, null, null), File, 0, Now);

        failed.IsFailure.ShouldBeTrue();
        failed.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["teamName", "productLineId"], ignoreOrder: true);
    }

    [Fact]
    public void ThePhotoMessageIsTheUiSpecWording()
    {
        GalleryEntry.PhotoRequiredMessage.ShouldBe("Choose a photo.");
    }

    [Fact]
    public void ACreateWithNothingToCheckIsRefusedByGuards()
    {
        Should.Throw<ArgumentNullException>(() => GalleryEntry.Check(null!));
        Should.Throw<ArgumentNullException>(() => GalleryEntry.CreateUpload(Guid.NewGuid(), null!, File, 0, Now));
        Should.Throw<ArgumentNullException>(() => GalleryEntry.CreateUpload(Guid.NewGuid(), Valid, null!, 0, Now));
    }
}
