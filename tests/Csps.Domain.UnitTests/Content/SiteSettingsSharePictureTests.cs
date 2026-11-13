using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-26: the settings row keeps one default link preview picture. A new picture hands back the id of the old one, and a removal hands back the id it cleared.</summary>
public sealed class SiteSettingsSharePictureTests
{
    private static readonly DateTimeOffset CreatedAt = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);

    private static LinePhotoFile Picture(string id, int width = 1200, int height = 630, int bytes = 90_000, string format = "jpg") => new(id, width, height, bytes, format);

    [Fact]
    public void ANewRowHasNoSharePicture()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        (settings.SharePicturePublicId, settings.SharePictureWidth, settings.SharePictureHeight, settings.SharePictureBytes, settings.SharePictureFormat)
            .ShouldBe((null, null, null, null, null));
    }

    [Fact]
    public void TheFirstPictureKeepsAllFiveFactsAndHasNoOldFileToHandBack()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var old = settings.SetSharePicture(Picture("csps-test/content/share/a/first", 1600, 840, 123_456, "png"));

        old.ShouldBeNull();
        (settings.SharePicturePublicId, settings.SharePictureWidth, settings.SharePictureHeight, settings.SharePictureBytes, settings.SharePictureFormat)
            .ShouldBe(("csps-test/content/share/a/first", 1600, 840, 123_456, "png"));
    }

    [Fact]
    public void ANewPictureReplacesEveryFactAndHandsBackTheOldId()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        settings.SetSharePicture(Picture("csps-test/content/share/a/first"));

        var old = settings.SetSharePicture(Picture("csps-test/content/share/a/second", 800, 420, 50_000, "webp"));

        old.ShouldBe("csps-test/content/share/a/first");
        (settings.SharePicturePublicId, settings.SharePictureWidth, settings.SharePictureHeight, settings.SharePictureBytes, settings.SharePictureFormat)
            .ShouldBe(("csps-test/content/share/a/second", 800, 420, 50_000, "webp"));
    }

    [Fact]
    public void RemovingClearsAllFiveFactsAndHandsBackTheId()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        settings.SetSharePicture(Picture("csps-test/content/share/a/first"));

        var old = settings.RemoveSharePicture();

        old.ShouldBe("csps-test/content/share/a/first");
        (settings.SharePicturePublicId, settings.SharePictureWidth, settings.SharePictureHeight, settings.SharePictureBytes, settings.SharePictureFormat)
            .ShouldBe((null, null, null, null, null));
    }

    [Fact]
    public void RemovingWhenThereIsNoPictureHandsBackNothing()
    {
        SiteSettings.CreateDefault(CreatedAt).RemoveSharePicture().ShouldBeNull();
    }

    [Fact]
    public void ASetWithNoFileIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => SiteSettings.CreateDefault(CreatedAt).SetSharePicture(null!));
    }

    [Fact]
    public void TheFolderIdIsTheFixedSingletonGuid()
    {
        SiteSettings.SingletonGuid.ShouldBe(new Guid("00000000-0000-0000-0000-000000000001"));
    }
}
