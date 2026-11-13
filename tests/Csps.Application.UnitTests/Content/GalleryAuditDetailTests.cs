using Csps.Application.Content;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.UnitTests.Content;

/// <summary>AUDIT-01, T-11-73: the gallery audit details name the team and the line, name changed fields without copying the note, and always fit the column.</summary>
public sealed class GalleryAuditDetailTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid Moto = Guid.Parse("b3d5f7a9-1c2e-4a60-8b94-5d7e9f1a3c20");

    private static GalleryEntry Upload(string team) => GalleryEntry.CreateUpload(
        GalleryEntry.NewId(Now),
        new GalleryUploadValues(team, Moto, null, "A private sentence", true),
        new LinePhotoFile("csps/content/gallery/abc/def", 800, 600, 1000, "jpg"),
        0,
        Now).Value;

    [Fact]
    public void ANamedDetailHoldsTheTeamAndTheLineTitleAndEncodesTheSeparators()
    {
        GalleryAuditDetail.Named(Upload("Tondo Sample Riders"), "Moto Riding Jerseys").ShouldBe("team=Tondo Sample Riders;line=Moto Riding Jerseys");
        GalleryAuditDetail.Named(Upload("A;B=C"), "L").ShouldBe("team=A%3BB%3DC;line=L");
    }

    [Fact]
    public void ADetailThatWouldNotFitLeavesTheLinePairOut()
    {
        var detail = GalleryAuditDetail.Named(Upload(new string(';', 80)), new string(';', 60));

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        detail.ShouldStartWith("team=");
        detail.ShouldNotContain("line=");
    }

    [Fact]
    public void AChangedDetailNamesTheFieldsAndTheChangedTeamAndLineButNeverTheNote()
    {
        var change = new GalleryUploadChanges(["team", "line", "pieces", "note"], "Old Team", "New Team", Moto, Guid.NewGuid(), null);

        var detail = GalleryAuditDetail.Changed(change, "Moto Riding Jerseys", "Basketball Jerseys");

        detail.ShouldBe("fields=team,line,pieces,note;team=Old Team>New Team;line=Moto Riding Jerseys>Basketball Jerseys");
        GalleryAuditDetail.Changed(change with { Fields = ["pieces", "note"] }, "a", "b").ShouldBe("fields=pieces,note");
    }

    [Fact]
    public void ADetailsGuardTheirArguments()
    {
        var change = new GalleryUploadChanges(["team"], "a", "b", Moto, Moto, null);

        Should.Throw<ArgumentNullException>(() => GalleryAuditDetail.Named(null!, "L"));
        Should.Throw<ArgumentNullException>(() => GalleryAuditDetail.Named(Upload("T"), null!));
        Should.Throw<ArgumentNullException>(() => GalleryAuditDetail.Changed(null!, "a", "b"));
        Should.Throw<ArgumentNullException>(() => GalleryAuditDetail.Changed(change, null!, "b"));
        Should.Throw<ArgumentNullException>(() => GalleryAuditDetail.Changed(change, "a", null!));
    }
}
