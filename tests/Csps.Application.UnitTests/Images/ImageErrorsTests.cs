using Csps.Application.Images;
using Csps.Domain.Common;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-02: the upload errors carry plain messages, and a client file name is cleaned before it is shown.</summary>
public sealed class ImageErrorsTests
{
    [Fact]
    public void TheTypeErrorNamesTheFileAndSitsOnTheFileField()
    {
        var error = ImageErrors.Type("photo.jpg");

        error.Kind.ShouldBe(ErrorKind.Validation);
        error.Code.ShouldBe("images.type");
        error.Message.ShouldBe("photo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
        error.FieldErrors.ShouldNotBeNull()["file"].ShouldBe([error.Message]);
    }

    [Theory]
    [InlineData(null, "This file")]
    [InlineData("", "This file")]
    [InlineData("   ", "This file")]
    [InlineData("\t\n", "This file")]
    [InlineData("C:\\Users\\someone\\Pictures\\team.jpg", "team.jpg")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData("folder/", "This file")]
    [InlineData("te\u0000am\u0007.jpg", "team.jpg")]
    public void AFileNameLosesFoldersAndControlCharactersAndFallsBackToThisFile(string? name, string expected)
    {
        ImageErrors.CleanName(name).ShouldBe(expected);
    }

    [Fact]
    public void AFileNameIsTrimmedToEightyCharacters()
    {
        ImageErrors.CleanName(new string('a', 120) + ".jpg").ShouldBe(new string('a', 80));
        ImageErrors.CleanName(new string('b', 80)).ShouldBe(new string('b', 80));
    }

    [Fact]
    public void TheOtherErrorsKeepTheirCodesKindsAndMessages()
    {
        ImageErrors.FileMissing.Kind.ShouldBe(ErrorKind.Validation);
        ImageErrors.FileMissing.Code.ShouldBe("images.file-missing");
        ImageErrors.FileMissing.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["file"]);
        ImageErrors.NotConfigured.Kind.ShouldBe(ErrorKind.Unavailable);
        ImageErrors.NotConfigured.Code.ShouldBe("images.not-configured");
        ImageErrors.NotConfigured.Message.ShouldBe("Photo uploads aren't set up yet.");
        ImageErrors.StorageFailed.Kind.ShouldBe(ErrorKind.Unavailable);
        ImageErrors.StorageFailed.Code.ShouldBe("images.storage-failed");
    }
}
