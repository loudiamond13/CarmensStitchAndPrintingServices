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

    private static GalleryEntry NewUpload(bool shown = true) => GalleryEntry.CreateUpload(GalleryEntry.NewId(Now), Valid with { IsShown = shown }, File, 0, Now).Value;

    [Fact]
    public void AnEditNamesTheChangedFieldsInFormOrderAndKeepsTheOldTeamAndLine()
    {
        var entry = NewUpload();
        var basketball = Guid.Parse("c4e6a8b0-2d3f-4b71-9ca5-6e8f0a2b4d31");

        var result = entry.UpdateUpload(new GalleryUploadValues("Tondo Sample Riders MC", basketball, 20m, "A new note", null));

        result.IsSuccess.ShouldBeTrue();
        result.Value.Fields.ShouldBe(["team", "line", "pieces", "note"]);
        (result.Value.OldTeam, result.Value.NewTeam, result.Value.OldLineId, result.Value.NewLineId, result.Value.NowShown).ShouldBe(("Tondo Sample Riders", "Tondo Sample Riders MC", Moto, basketball, null));
        result.Value.HasChange.ShouldBeTrue();
        (entry.TeamName, entry.ProductLineId, entry.Pieces, entry.Note, entry.IsShown).ShouldBe(("Tondo Sample Riders MC", basketball, 20, "A new note", true));
    }

    [Fact]
    public void AFormWithTheSameValuesChangesNothingAndANullShownFlagKeepsTheFlag()
    {
        var entry = NewUpload();

        var result = entry.UpdateUpload(new GalleryUploadValues("  Tondo Sample Riders ", Moto, 12m, "Dri-fit mesh, V-neck", null));

        result.Value.Fields.ShouldBeEmpty();
        result.Value.NowShown.ShouldBeNull();
        result.Value.HasChange.ShouldBeFalse();
    }

    [Fact]
    public void AnEditCanClearThePiecesAndTheNoteAndFlipTheShownFlagWhichIsNotAField()
    {
        var entry = NewUpload();

        var cleared = entry.UpdateUpload(Valid with { Pieces = null, Note = "  ", IsShown = false });
        var again = entry.UpdateUpload(Valid with { Pieces = null, Note = null, IsShown = false });
        var shown = entry.UpdateUpload(Valid with { Pieces = null, Note = null, IsShown = true });

        cleared.Value.Fields.ShouldBe(["pieces", "note"]);
        cleared.Value.NowShown.ShouldBe(false);
        cleared.Value.HasChange.ShouldBeTrue();
        again.Value.HasChange.ShouldBeFalse();
        shown.Value.Fields.ShouldBeEmpty();
        shown.Value.NowShown.ShouldBe(true);
        shown.Value.HasChange.ShouldBeTrue();
        (entry.Pieces, entry.Note, entry.IsShown).ShouldBe((null, null, true));
    }

    [Fact]
    public void ABrokenEditChangesNothingAndNamesTheFields()
    {
        var entry = NewUpload();

        var result = entry.UpdateUpload(new GalleryUploadValues("", null, 0m, new string('n', 121), false));

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["teamName", "productLineId", "pieces", "note"], ignoreOrder: true);
        (entry.TeamName, entry.ProductLineId, entry.Pieces, entry.Note, entry.IsShown).ShouldBe(("Tondo Sample Riders", Moto, 12, "Dri-fit mesh, V-neck", true));
    }

    [Fact]
    public void ReplacingThePhotoGivesBackTheOldIdAndKeepsTheRest()
    {
        var entry = NewUpload();

        var old = entry.ReplacePhoto(new LinePhotoFile("csps/content/gallery/abc/new", 900, 700, 222, "png"));

        old.ShouldBe("csps/content/gallery/abc/def");
        (entry.PublicId, entry.Width, entry.Height, entry.Bytes, entry.Format).ShouldBe(("csps/content/gallery/abc/new", 900, 700, 222, "png"));
        entry.TeamName.ShouldBe("Tondo Sample Riders");
    }

    [Fact]
    public void HidingAndShowingSayWhetherTheFlagChanged()
    {
        var entry = NewUpload();

        entry.Hide().ShouldBeTrue();
        entry.Hide().ShouldBeFalse();
        entry.IsShown.ShouldBeFalse();
        entry.Show().ShouldBeTrue();
        entry.Show().ShouldBeFalse();
        entry.IsShown.ShouldBeTrue();
    }

    [Fact]
    public void AnOrderEntryRefusesEveryUploadChangeBecauseItIsManagedFromItsOrder()
    {
        var entry = GalleryEntry.ForOrder(Guid.NewGuid(), 0, Now);

        Should.Throw<InvalidOperationException>(() => entry.UpdateUpload(Valid));
        Should.Throw<InvalidOperationException>(() => entry.ReplacePhoto(File));
        Should.Throw<InvalidOperationException>(() => entry.Hide());
        Should.Throw<InvalidOperationException>(() => entry.Show());
    }

    [Fact]
    public void TheUploadChangesGuardTheirArguments()
    {
        var entry = NewUpload();

        Should.Throw<ArgumentNullException>(() => entry.UpdateUpload(null!));
        Should.Throw<ArgumentNullException>(() => entry.ReplacePhoto(null!));
    }

    [Fact]
    public void TwoEntriesOfAnyKindTradePlacesInTheGalleryOrder()
    {
        var upload = GalleryEntry.CreateUpload(GalleryEntry.NewId(Now), Valid, File, 7, Now).Value;
        var order = GalleryEntry.ForOrder(Guid.NewGuid(), -2, Now);

        upload.SwapPositionWith(order);

        (upload.Position, order.Position).ShouldBe((-2, 7));
        Should.Throw<ArgumentNullException>(() => upload.SwapPositionWith(null!));
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
